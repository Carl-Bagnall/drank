import { Hono } from "hono";
import type { AppEnv } from "../index";
import type { ApiError } from "../../shared/types";
import { RATING_MAX, RATING_MIN, RATING_STEP, isValidRating, toHalfPoints } from "../../shared/rating";
import {
  deleteRating,
  getRatingBreakdown,
  setRating,
} from "../db/ratings";
import { readJsonObject } from "../validate";

export const ratings = new Hono<AppEnv>();

const UNAUTHENTICATED: ApiError = {
  error: "unauthenticated",
  message: "You need to be signed in to rate a drink.",
};

/**
 * POST /api/drinks/:id/rating
 *
 * Rating is deliberately independent of collecting: `ratings` and
 * `collection_entries` are separate tables, so you can score a drink you do
 * not own. The client offers to add it afterwards rather than forcing it.
 */
ratings.post("/drinks/:id/rating", async (c) => {
  const user = c.get("user");
  if (!user) return c.json(UNAUTHENTICATED, 401);

  const drinkId = c.req.param("id");
  const body = await readJsonObject(c.req.raw);

  const score = body["score"];
  if (typeof score !== "number" || !isValidRating(score)) {
    const error: ApiError = {
      error: "bad_request",
      message: `score must be between ${RATING_MIN} and ${RATING_MAX} in steps of ${RATING_STEP}.`,
    };
    return c.json(error, 400);
  }

  const result = await setRating(c.env.DB, user.id, drinkId, toHalfPoints(score));

  if (result.status === "no_such_drink") {
    const error: ApiError = {
      error: "not_found",
      message: "No drink with that id.",
    };
    return c.json(error, 404);
  }

  return c.json({ viewerRating: score, community: result.community });
});

/** DELETE /api/drinks/:id/rating — withdraw a score. */
ratings.delete("/drinks/:id/rating", async (c) => {
  const user = c.get("user");
  if (!user) return c.json(UNAUTHENTICATED, 401);

  const drinkId = c.req.param("id");
  const removed = await deleteRating(c.env.DB, user.id, drinkId);

  if (!removed) {
    const error: ApiError = {
      error: "not_found",
      message: "You have not rated that drink.",
    };
    return c.json(error, 404);
  }

  const { community } = await getRatingBreakdown(c.env.DB, drinkId);
  return c.json({ viewerRating: null, community });
});

/** GET /api/drinks/:id/ratings — the community spread. Public. */
ratings.get("/drinks/:id/ratings", async (c) => {
  return c.json(await getRatingBreakdown(c.env.DB, c.req.param("id")));
});
