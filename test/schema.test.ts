import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

/**
 * These tests assert the guarantees that live in the database itself, rather
 * than in application code. They matter because the API is not the only thing
 * that will ever write to D1 — a migration, a backfill or a console query can
 * too, and the constraints are what hold in every case.
 */

const USER_ID = "test-user";
const DRINK_ID = "test-drink";

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM ratings"),
    env.DB.prepare("DELETE FROM collection_entries"),
    env.DB.prepare("DELETE FROM drinks"),
    env.DB.prepare("DELETE FROM users"),
  ]);

  await env.DB.prepare(
    "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
  )
    .bind(USER_ID, "tester", "tester@example.com", "not-a-real-hash")
    .run();

  await env.DB.prepare(
    "INSERT INTO drinks (id, name, brand, brand_normalised) VALUES (?, ?, ?, ?)",
  )
    .bind(DRINK_ID, "Coca-Cola Cherry", "Coca-Cola", "coca-cola")
    .run();
});

describe("drinks", () => {
  it("accepts a drink with only a name and a brand", async () => {
    const result = await env.DB.prepare(
      "INSERT INTO drinks (id, name, brand, brand_normalised) VALUES (?, ?, ?, ?)",
    )
      .bind("minimal", "Cherry Cream Soda", "Local Fizz Co", "local fizz co")
      .run();

    expect(result.success).toBe(true);
  });

  it("rejects a blank name", async () => {
    await expect(
      env.DB.prepare(
        "INSERT INTO drinks (id, name, brand, brand_normalised) VALUES (?, ?, ?, ?)",
      )
        .bind("blank", "   ", "Brand", "brand")
        .run(),
    ).rejects.toThrow();
  });

  it("defaults new drinks to published", async () => {
    const row = await env.DB.prepare("SELECT status FROM drinks WHERE id = ?")
      .bind(DRINK_ID)
      .first<{ status: string }>();

    expect(row?.status).toBe("published");
  });

  it("rejects an unknown status", async () => {
    await expect(
      env.DB.prepare("UPDATE drinks SET status = ? WHERE id = ?")
        .bind("deleted", DRINK_ID)
        .run(),
    ).rejects.toThrow();
  });

  it("enforces unique barcodes but allows many drinks without one", async () => {
    await env.DB.prepare(
      "INSERT INTO drinks (id, name, brand, brand_normalised, barcode) VALUES (?, ?, ?, ?, ?)",
    )
      .bind("with-barcode", "Sprite", "Sprite", "sprite", "5449000014535")
      .run();

    await expect(
      env.DB.prepare(
        "INSERT INTO drinks (id, name, brand, brand_normalised, barcode) VALUES (?, ?, ?, ?, ?)",
      )
        .bind("dupe-barcode", "Sprite Again", "Sprite", "sprite", "5449000014535")
        .run(),
    ).rejects.toThrow();

    // Two barcode-less drinks must coexist: barcodes are optional.
    const second = await env.DB.prepare(
      "INSERT INTO drinks (id, name, brand, brand_normalised) VALUES (?, ?, ?, ?)",
    )
      .bind("no-barcode-2", "Fanta Lemon", "Fanta", "fanta")
      .run();

    expect(second.success).toBe(true);
  });
});

describe("collection entries", () => {
  it("prevents the same drink being collected twice by one user", async () => {
    await env.DB.prepare(
      "INSERT INTO collection_entries (id, user_id, drink_id) VALUES (?, ?, ?)",
    )
      .bind("entry-1", USER_ID, DRINK_ID)
      .run();

    await expect(
      env.DB.prepare(
        "INSERT INTO collection_entries (id, user_id, drink_id) VALUES (?, ?, ?)",
      )
        .bind("entry-2", USER_ID, DRINK_ID)
        .run(),
    ).rejects.toThrow();
  });

  it("allows two different users to collect the same drink", async () => {
    await env.DB.prepare(
      "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
    )
      .bind("other-user", "other", "other@example.com", "not-a-real-hash")
      .run();

    await env.DB.prepare(
      "INSERT INTO collection_entries (id, user_id, drink_id) VALUES (?, ?, ?)",
    )
      .bind("entry-1", USER_ID, DRINK_ID)
      .run();

    const result = await env.DB.prepare(
      "INSERT INTO collection_entries (id, user_id, drink_id) VALUES (?, ?, ?)",
    )
      .bind("entry-2", "other-user", DRINK_ID)
      .run();

    expect(result.success).toBe(true);
  });

  it("removes collection entries when the drink is deleted", async () => {
    await env.DB.prepare(
      "INSERT INTO collection_entries (id, user_id, drink_id) VALUES (?, ?, ?)",
    )
      .bind("entry-1", USER_ID, DRINK_ID)
      .run();

    await env.DB.prepare("DELETE FROM drinks WHERE id = ?").bind(DRINK_ID).run();

    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM collection_entries",
    ).first<{ count: number }>();

    expect(row?.count).toBe(0);
  });
});

describe("ratings", () => {
  it("accepts the full half-point range", async () => {
    for (const score of [0, 15, 20]) {
      const result = await env.DB.prepare(
        "INSERT INTO ratings (id, user_id, drink_id, score) VALUES (?, ?, ?, ?)",
      )
        .bind(`rating-${score}`, USER_ID, DRINK_ID, score)
        .run();

      expect(result.success).toBe(true);
      await env.DB.prepare("DELETE FROM ratings").run();
    }
  });

  it("rejects a score outside 0-20 half-points", async () => {
    for (const score of [-1, 21]) {
      await expect(
        env.DB.prepare(
          "INSERT INTO ratings (id, user_id, drink_id, score) VALUES (?, ?, ?, ?)",
        )
          .bind(`bad-${score}`, USER_ID, DRINK_ID, score)
          .run(),
      ).rejects.toThrow();
    }
  });

  it("allows only one rating per user per drink", async () => {
    await env.DB.prepare(
      "INSERT INTO ratings (id, user_id, drink_id, score) VALUES (?, ?, ?, ?)",
    )
      .bind("rating-1", USER_ID, DRINK_ID, 16)
      .run();

    await expect(
      env.DB.prepare(
        "INSERT INTO ratings (id, user_id, drink_id, score) VALUES (?, ?, ?, ?)",
      )
        .bind("rating-2", USER_ID, DRINK_ID, 18)
        .run(),
    ).rejects.toThrow();
  });

  it("computes a community average without a stored aggregate", async () => {
    await env.DB.prepare(
      "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
    )
      .bind("user-b", "userb", "b@example.com", "not-a-real-hash")
      .run();

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO ratings (id, user_id, drink_id, score) VALUES (?, ?, ?, ?)",
      ).bind("r1", USER_ID, DRINK_ID, 16),
      env.DB.prepare(
        "INSERT INTO ratings (id, user_id, drink_id, score) VALUES (?, ?, ?, ?)",
      ).bind("r2", "user-b", DRINK_ID, 18),
    ]);

    const row = await env.DB.prepare(
      "SELECT AVG(score) / 2.0 AS average, COUNT(*) AS count FROM ratings WHERE drink_id = ?",
    )
      .bind(DRINK_ID)
      .first<{ average: number; count: number }>();

    expect(row?.average).toBe(8.5);
    expect(row?.count).toBe(2);
  });
});
