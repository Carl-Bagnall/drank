import { describe, expect, it } from "vitest";
import {
  averageFromTenths,
  formatRating,
  fromTenths,
  isValidRating,
  toTenths,
} from "../src/shared/rating";

describe("rating scale", () => {
  it("accepts tenths across the range", () => {
    for (const score of [0, 0.1, 0.5, 5, 7.5, 8.2, 9.9, 10]) {
      expect(isValidRating(score), `score ${score}`).toBe(true);
    }
  });

  it("accepts every tenth from 0 to 10 and round-trips it exactly", () => {
    for (let tenths = 0; tenths <= 100; tenths++) {
      const score = tenths / 10;
      expect(isValidRating(score), `score ${score}`).toBe(true);
      expect(toTenths(score), `score ${score}`).toBe(tenths);
      expect(fromTenths(toTenths(score)), `score ${score}`).toBe(score);
    }
  });

  it("accepts a score that has drifted through accumulated addition", () => {
    // Adding 0.1 repeatedly does not land on an exact tenth, and a client
    // computing a score that way plainly means 8.2. It should be stored, not
    // rejected as off-step.
    let drifted = 0;
    for (let i = 0; i < 82; i++) drifted += 0.1;

    expect(drifted).not.toBe(8.2);
    expect(isValidRating(drifted)).toBe(true);
    expect(toTenths(drifted)).toBe(82);
  });

  it("rejects out-of-range and off-step values", () => {
    for (const score of [
      -0.1,
      10.1,
      7.25,
      8.15,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(isValidRating(score), `score ${score}`).toBe(false);
    }
  });

  it("round-trips through the stored representation", () => {
    for (const score of [0, 0.1, 3, 7.5, 8.2, 10]) {
      expect(fromTenths(toTenths(score)), `score ${score}`).toBe(score);
    }
  });

  it("stores 8.2 as 82 tenths", () => {
    expect(toTenths(8.2)).toBe(82);
    expect(toTenths(7.5)).toBe(75);
    expect(toTenths(10)).toBe(100);
  });

  it("throws rather than silently rounding an invalid score", () => {
    expect(() => toTenths(7.25)).toThrow(RangeError);
    expect(() => toTenths(11)).toThrow(RangeError);
    expect(() => toTenths(-1)).toThrow(RangeError);
  });

  it("formats whole numbers without a trailing decimal", () => {
    expect(formatRating(8)).toBe("8");
    expect(formatRating(8.2)).toBe("8.2");
    expect(formatRating(8.5)).toBe("8.5");
    expect(formatRating(null)).toBe("—");
  });

  it("averages tenths onto the 0-10 scale, to one decimal place", () => {
    // 80, 85, 90 tenths => 8.0, 8.5, 9.0 => mean 8.5
    expect(averageFromTenths([80, 85, 90])).toBe(8.5);
    // 82 and 87 => 8.2 and 8.7 => 8.45, rounded to 8.5
    expect(averageFromTenths([82, 87])).toBe(8.5);
    // 70 and 73 => 7.0 and 7.3 => 7.15, rounded to 7.2
    expect(averageFromTenths([70, 73])).toBe(7.2);
  });

  it("reports no community rating for an empty set", () => {
    expect(averageFromTenths([])).toBeNull();
  });
});
