import { describe, expect, it } from "vitest";
import { E1RM_MAX_REPS, epley1RM, roundE1RM } from "./e1rm";

describe("epley1RM", () => {
  it("applies the formula at one rep rather than returning the load", () => {
    // Epley adds 3.33% even at a single. That is the formula, not a bug, and
    // this test pins it so nobody "fixes" it into returning 100.
    expect(epley1RM(100, 1)).toBeCloseTo(103.333, 3);
  });

  it("matches the formula at a textbook working set", () => {
    // 100 * (1 + 10/30) = 133.333
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 3);
  });

  it("handles fractional loads", () => {
    expect(epley1RM(62.5, 8)).toBeCloseTo(62.5 * (1 + 8 / 30), 6);
  });

  it("accepts the boundary rep count", () => {
    expect(epley1RM(50, E1RM_MAX_REPS)).toBeCloseTo(50 * (1 + 12 / 30), 6);
  });

  it("refuses to estimate past the rep ceiling", () => {
    // Epley drifts high in the teens, so no number is better than a wrong one.
    expect(epley1RM(50, E1RM_MAX_REPS + 1)).toBeNull();
    expect(epley1RM(50, 20)).toBeNull();
  });

  it("rejects sets that are not sets", () => {
    expect(epley1RM(50, 0)).toBeNull();
    expect(epley1RM(50, -3)).toBeNull();
    expect(epley1RM(0, 10)).toBeNull();
    expect(epley1RM(-20, 10)).toBeNull();
  });

  it("rejects non-finite input rather than propagating NaN", () => {
    expect(epley1RM(Number.NaN, 10)).toBeNull();
    expect(epley1RM(50, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("is monotonic in both weight and reps", () => {
    expect(epley1RM(100, 5)!).toBeGreaterThan(epley1RM(100, 4)!);
    expect(epley1RM(102.5, 5)!).toBeGreaterThan(epley1RM(100, 5)!);
  });
});

describe("roundE1RM", () => {
  it("rounds to the nearest half unit", () => {
    expect(roundE1RM(133.333)).toBe(133.5);
    expect(roundE1RM(133.2)).toBe(133);
    expect(roundE1RM(100)).toBe(100);
  });
});
