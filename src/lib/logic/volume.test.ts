import { describe, expect, it } from "vitest";
import {
  compareWeeks,
  countSetsPerMuscle,
  startOfWeek,
  weekKey,
  weeklySetsPerMuscle,
  type MuscleMap,
  type VolumeSet,
} from "./volume";

const muscles = new Map<string, MuscleMap>([
  ["pulldown", { primaryMuscle: "lats", secondaryMuscles: ["biceps", "upper back"] }],
  ["curl", { primaryMuscle: "biceps", secondaryMuscles: [] }],
  ["press", { primaryMuscle: "chest", secondaryMuscles: ["front delts", "triceps"] }],
]);

const set = (exerciseId: string, completedAt: string, isWarmup = false): VolumeSet => ({
  exerciseId,
  completedAt,
  isWarmup,
});

describe("countSetsPerMuscle", () => {
  it("counts a direct set as one and each secondary as a half", () => {
    const totals = countSetsPerMuscle([set("pulldown", "2026-10-21T10:00:00")], muscles);
    expect(totals.get("lats")).toBe(1);
    expect(totals.get("biceps")).toBe(0.5);
    expect(totals.get("upper back")).toBe(0.5);
  });

  it("adds fractional and direct work for the same muscle", () => {
    // Three pulldowns give biceps 1.5, two curls give biceps 2, total 3.5.
    const sets = [
      set("pulldown", "2026-10-21T10:00:00"),
      set("pulldown", "2026-10-21T10:05:00"),
      set("pulldown", "2026-10-21T10:10:00"),
      set("curl", "2026-10-21T10:20:00"),
      set("curl", "2026-10-21T10:25:00"),
    ];
    const totals = countSetsPerMuscle(sets, muscles);
    expect(totals.get("biceps")).toBe(3.5);
    expect(totals.get("lats")).toBe(3);
  });

  it("excludes warm-ups", () => {
    const sets = [
      set("press", "2026-10-21T10:00:00", true),
      set("press", "2026-10-21T10:05:00"),
    ];
    const totals = countSetsPerMuscle(sets, muscles);
    expect(totals.get("chest")).toBe(1);
    expect(totals.get("triceps")).toBe(0.5);
  });

  it("omits muscles with no work rather than listing them as zero", () => {
    const totals = countSetsPerMuscle([set("curl", "2026-10-21T10:00:00")], muscles);
    expect(totals.has("lats")).toBe(false);
    expect([...totals.keys()]).toEqual(["biceps"]);
  });

  it("never double counts a muscle listed as both primary and secondary", () => {
    const odd = new Map<string, MuscleMap>([
      ["odd", { primaryMuscle: "biceps", secondaryMuscles: ["biceps", "forearms"] }],
    ]);
    const totals = countSetsPerMuscle([set("odd", "2026-10-21T10:00:00")], odd);
    expect(totals.get("biceps")).toBe(1);
    expect(totals.get("forearms")).toBe(0.5);
  });

  it("skips sets for an exercise it cannot resolve", () => {
    const totals = countSetsPerMuscle([set("deleted", "2026-10-21T10:00:00")], muscles);
    expect(totals.size).toBe(0);
  });

  it("returns an empty map for no sets", () => {
    expect(countSetsPerMuscle([], muscles).size).toBe(0);
  });
});

describe("startOfWeek and weekKey", () => {
  it("treats Monday as the start of the week", () => {
    // 2026-10-21 is a Wednesday; its week starts Monday 2026-10-19.
    expect(weekKey(new Date(2026, 9, 21))).toBe("2026-10-19");
    expect(startOfWeek(new Date(2026, 9, 21)).getDay()).toBe(1);
  });

  it("keeps Sunday in the week that started the Monday before", () => {
    // 2026-10-25 is a Sunday. A weekend session belongs to the week it ends.
    expect(weekKey(new Date(2026, 9, 25))).toBe("2026-10-19");
  });

  it("rolls over on Monday", () => {
    expect(weekKey(new Date(2026, 9, 26))).toBe("2026-10-26");
  });
});

describe("weeklySetsPerMuscle", () => {
  it("buckets by week, most recent first", () => {
    const sets = [
      set("curl", "2026-10-20T10:00:00"),
      set("curl", "2026-10-27T10:00:00"),
      set("curl", "2026-10-28T10:00:00"),
    ];
    const weeks = weeklySetsPerMuscle(sets, muscles);
    expect(weeks.map((w) => w.key)).toEqual(["2026-10-26", "2026-10-19"]);
    expect(weeks[0].perMuscle.get("biceps")).toBe(2);
    expect(weeks[1].perMuscle.get("biceps")).toBe(1);
  });

  it("drops sets with an unparseable timestamp", () => {
    const weeks = weeklySetsPerMuscle([set("curl", "not a date")], muscles);
    expect(weeks).toEqual([]);
  });
});

describe("compareWeeks", () => {
  const now = new Date(2026, 9, 28); // Wednesday, week of 2026-10-26

  it("puts this week next to last week", () => {
    const sets = [
      set("curl", "2026-10-27T10:00:00"),
      set("curl", "2026-10-28T10:00:00"),
      set("curl", "2026-10-21T10:00:00"),
    ];
    const rows = compareWeeks(sets, muscles, now);
    const biceps = rows.find((r) => r.muscle === "biceps");
    expect(biceps).toEqual({ muscle: "biceps", thisWeek: 2, lastWeek: 1 });
  });

  it("keeps a muscle trained last week but skipped this week, at zero", () => {
    const rows = compareWeeks([set("pulldown", "2026-10-21T10:00:00")], muscles, now);
    expect(rows.find((r) => r.muscle === "lats")).toEqual({
      muscle: "lats",
      thisWeek: 0,
      lastWeek: 1,
    });
  });

  it("ignores weeks outside the two being compared", () => {
    const rows = compareWeeks([set("curl", "2026-09-01T10:00:00")], muscles, now);
    expect(rows).toEqual([]);
  });

  it("returns nothing when there is no work in either week", () => {
    expect(compareWeeks([], muscles, now)).toEqual([]);
  });
});
