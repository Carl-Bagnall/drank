import { describe, expect, it } from "vitest";
import {
  averageFromHalfPoints,
  formatRating,
  fromHalfPoints,
  isValidRating,
  ratingOptions,
  toHalfPoints,
} from "../src/shared/rating";

describe("rating scale", () => {
  it("accepts whole and half points across the range", () => {
    for (const score of [0, 0.5, 5, 7.5, 9.5, 10]) {
      expect(isValidRating(score)).toBe(true);
    }
  });

  it("rejects out-of-range and off-step values", () => {
    for (const score of [-0.5, 10.5, 7.25, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isValidRating(score)).toBe(false);
    }
  });

  it("round-trips through the stored half-point representation", () => {
    for (const score of [0, 0.5, 3, 7.5, 10]) {
      expect(fromHalfPoints(toHalfPoints(score))).toBe(score);
    }
  });

  it("stores 7.5 as 15 half-points", () => {
    expect(toHalfPoints(7.5)).toBe(15);
  });

  it("throws rather than silently rounding an invalid score", () => {
    expect(() => toHalfPoints(7.25)).toThrow(RangeError);
    expect(() => toHalfPoints(11)).toThrow(RangeError);
  });

  it("formats whole numbers without a trailing decimal", () => {
    expect(formatRating(8)).toBe("8");
    expect(formatRating(8.5)).toBe("8.5");
    expect(formatRating(null)).toBe("—");
  });

  it("averages half-points onto the 0-10 scale, to one decimal place", () => {
    // 16, 17, 18 half-points => 8.0, 8.5, 9.0 => mean 8.5
    expect(averageFromHalfPoints([16, 17, 18])).toBe(8.5);
    // 17 and 18 => 8.5 and 9.0 => 8.75, rounded to 8.8
    expect(averageFromHalfPoints([17, 18])).toBe(8.8);
  });

  it("reports no community rating for an empty set", () => {
    expect(averageFromHalfPoints([])).toBeNull();
  });

  it("offers 21 selectable values from 0 to 10", () => {
    const options = ratingOptions();
    expect(options).toHaveLength(21);
    expect(options[0]).toBe(0);
    expect(options.at(-1)).toBe(10);
    expect(options).toContain(7.5);
  });
});
