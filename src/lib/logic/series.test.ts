import { describe, expect, it } from "vitest";
import { sessionSeries, withinRange, type SeriesSet } from "./series";

const set = (
  workoutId: string,
  weight: number,
  reps: number,
  completedAt: string,
  isWarmup = false,
): SeriesSet => ({ workoutId, weight, reps, completedAt, isWarmup });

describe("sessionSeries", () => {
  it("collapses a session's sets into one point", () => {
    const points = sessionSeries([
      set("w1", 50, 10, "2026-10-01T10:00:00.000Z"),
      set("w1", 50, 9, "2026-10-01T10:05:00.000Z"),
      set("w1", 47.5, 9, "2026-10-01T10:10:00.000Z"),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0].topWeight).toBe(50);
    expect(points[0].topReps).toBe(10);
    expect(points[0].e1rm).toBeCloseTo(50 * (1 + 10 / 30), 6);
  });

  it("orders sessions oldest first", () => {
    const points = sessionSeries([
      set("w2", 55, 8, "2026-10-08T10:00:00.000Z"),
      set("w1", 50, 8, "2026-10-01T10:00:00.000Z"),
    ]);
    expect(points.map((p) => p.topWeight)).toEqual([50, 55]);
  });

  it("excludes warm-ups from the top set", () => {
    const points = sessionSeries([
      set("w1", 100, 10, "2026-10-01T10:00:00.000Z", true),
      set("w1", 50, 10, "2026-10-01T10:05:00.000Z"),
    ]);
    expect(points[0].topWeight).toBe(50);
  });

  it("breaks a tie on weight by reps", () => {
    const points = sessionSeries([
      set("w1", 50, 6, "2026-10-01T10:00:00.000Z"),
      set("w1", 50, 11, "2026-10-01T10:05:00.000Z"),
    ]);
    expect(points[0].topReps).toBe(11);
  });

  it("reports a null estimate when every set is past the Epley ceiling", () => {
    const points = sessionSeries([set("w1", 40, 20, "2026-10-01T10:00:00.000Z")]);
    expect(points[0].topWeight).toBe(40);
    expect(points[0].e1rm).toBeNull();
  });

  it("takes the best estimate in the session, which need not be the top set", () => {
    // 50x10 estimates 66.7; 55x5 estimates 64.2. The heavier set is not the best.
    const points = sessionSeries([
      set("w1", 50, 10, "2026-10-01T10:00:00.000Z"),
      set("w1", 55, 5, "2026-10-01T10:05:00.000Z"),
    ]);
    expect(points[0].topWeight).toBe(55);
    expect(points[0].e1rm).toBeCloseTo(50 * (1 + 10 / 30), 6);
  });

  it("dates a session from its earliest set", () => {
    const points = sessionSeries([
      set("w1", 50, 8, "2026-10-01T11:00:00.000Z"),
      set("w1", 50, 8, "2026-10-01T10:00:00.000Z"),
    ]);
    expect(points[0].t).toBe(new Date("2026-10-01T10:00:00.000Z").getTime());
  });

  it("drops sets that are not sets", () => {
    expect(sessionSeries([set("w1", 0, 10, "2026-10-01T10:00:00.000Z")])).toEqual([]);
    expect(sessionSeries([set("w1", 50, 0, "2026-10-01T10:00:00.000Z")])).toEqual([]);
  });

  it("returns nothing for no sets", () => {
    expect(sessionSeries([])).toEqual([]);
  });
});

describe("withinRange", () => {
  const now = new Date("2026-10-29T00:00:00.000Z").getTime();
  const points = [
    { t: new Date("2026-04-01T00:00:00.000Z").getTime() },
    { t: new Date("2026-09-01T00:00:00.000Z").getTime() },
    { t: new Date("2026-10-20T00:00:00.000Z").getTime() },
  ];

  it("keeps everything on all", () => {
    expect(withinRange(points, "all", now)).toHaveLength(3);
  });

  it("trims to four weeks", () => {
    expect(withinRange(points, "4w", now)).toHaveLength(1);
  });

  it("trims to twelve weeks", () => {
    expect(withinRange(points, "12w", now)).toHaveLength(2);
  });

  it("trims to six months", () => {
    expect(withinRange(points, "6m", now)).toHaveLength(2);
  });
});
