import { describe, expect, it } from "vitest";
import {
  dayTrackers,
  formatChange,
  formatTonnage,
  niceAxis,
  sessionTonnage,
  tonnageFormatter,
  UNPLANNED_LABEL,
  type TonnageSet,
  type TonnageWorkout,
} from "./tonnage";

const workout = (
  id: string,
  dayName: string | null,
  startedAt: string,
  finished = true,
): TonnageWorkout => ({
  id,
  dayName,
  startedAt,
  finishedAt: finished ? startedAt : null,
});

const set = (workoutId: string, weight: number, reps: number, isWarmup = false): TonnageSet => ({
  workoutId,
  weight,
  reps,
  isWarmup,
});

describe("sessionTonnage", () => {
  it("sums weight times reps over the working sets", () => {
    const result = sessionTonnage([set("w1", 60, 10), set("w1", 60, 10), set("w1", 60, 10)]);
    expect(result.total).toBe(1800);
    expect(result.sets).toBe(3);
  });

  it("excludes warm-ups, so an extra primer cannot read as progress", () => {
    const withPrimer = sessionTonnage([set("w1", 60, 10), set("w1", 20, 12, true)]);
    expect(withPrimer.total).toBe(600);
    expect(withPrimer.sets).toBe(1);
  });

  it("ignores empty and unloaded rows", () => {
    const result = sessionTonnage([set("w1", 0, 10), set("w1", 60, 0), set("w1", 60, 5)]);
    expect(result.total).toBe(300);
    expect(result.sets).toBe(1);
  });

  it("rounds away float noise from fractional plates", () => {
    // 2.5 kg increments times odd rep counts produce long floats.
    const result = sessionTonnage([set("w1", 62.5, 7), set("w1", 57.5, 9)]);
    expect(result.total).toBe(955);
  });

  it("is zero for a session with nothing logged", () => {
    expect(sessionTonnage([])).toEqual({ total: 0, sets: 0 });
  });
});

describe("dayTrackers", () => {
  it("gives each workout day its own history", () => {
    const workouts = [
      workout("w1", "Push A", "2026-10-01T10:00:00Z"),
      workout("w2", "Pull A", "2026-10-02T10:00:00Z"),
      workout("w3", "Push A", "2026-10-08T10:00:00Z"),
    ];
    const sets = [
      set("w1", 60, 10),
      set("w2", 50, 10),
      set("w3", 65, 10),
    ];

    const trackers = dayTrackers(workouts, sets);
    expect(trackers).toHaveLength(2);

    const push = trackers.find((t) => t.dayName === "Push A");
    expect(push?.points.map((p) => p.total)).toEqual([600, 650]);
  });

  it("compares a day against the previous time that same day was trained", () => {
    const workouts = [
      workout("w1", "Push A", "2026-10-01T10:00:00Z"),
      // A heavier leg day in between must not affect Push A's comparison.
      workout("w2", "Legs A", "2026-10-03T10:00:00Z"),
      workout("w3", "Push A", "2026-10-08T10:00:00Z"),
    ];
    const sets = [set("w1", 100, 10), set("w2", 500, 10), set("w3", 110, 10)];

    const push = dayTrackers(workouts, sets).find((t) => t.dayName === "Push A");
    expect(push?.latest).toBe(1100);
    expect(push?.previous).toBe(1000);
    expect(push?.change).toBeCloseTo(0.1);
  });

  it("reports no comparison for a first session rather than zero change", () => {
    const trackers = dayTrackers([workout("w1", "Push A", "2026-10-01T10:00:00Z")], [set("w1", 60, 10)]);
    expect(trackers[0].previous).toBeNull();
    expect(trackers[0].change).toBeNull();
  });

  it("excludes a workout still in progress, so the newest point cannot dip", () => {
    const workouts = [
      workout("w1", "Push A", "2026-10-01T10:00:00Z"),
      workout("w2", "Push A", "2026-10-08T10:00:00Z", false),
    ];
    const sets = [set("w1", 60, 10), set("w2", 60, 2)];

    const trackers = dayTrackers(workouts, sets);
    expect(trackers[0].points).toHaveLength(1);
    expect(trackers[0].latest).toBe(600);
  });

  it("treats a rest day as an absence, not a zero", () => {
    const workouts = [
      workout("w1", "Push A", "2026-10-01T10:00:00Z"),
      workout("rest", "Rest", "2026-10-02T10:00:00Z"),
    ];
    const trackers = dayTrackers(workouts, [set("w1", 60, 10)]);

    expect(trackers).toHaveLength(1);
    expect(trackers[0].dayName).toBe("Push A");
  });

  it("keeps ad-hoc sessions in their own bucket instead of dropping them", () => {
    const trackers = dayTrackers([workout("w1", null, "2026-10-01T10:00:00Z")], [set("w1", 60, 10)]);
    expect(trackers[0].dayName).toBeNull();
    expect(trackers[0].label).toBe(UNPLANNED_LABEL);
  });

  it("orders days by the most recently trained", () => {
    const workouts = [
      workout("w1", "Push A", "2026-10-01T10:00:00Z"),
      workout("w2", "Pull A", "2026-10-09T10:00:00Z"),
      workout("w3", "Legs A", "2026-10-05T10:00:00Z"),
    ];
    const sets = [set("w1", 60, 10), set("w2", 60, 10), set("w3", 60, 10)];

    expect(dayTrackers(workouts, sets).map((t) => t.label)).toEqual([
      "Pull A",
      "Legs A",
      "Push A",
    ]);
  });

  it("survives a renamed day by keeping the two names apart", () => {
    // The name is stamped per workout, so sessions logged under the old name
    // keep it. They are genuinely different labels and must not be merged.
    const workouts = [
      workout("w1", "Push A", "2026-10-01T10:00:00Z"),
      workout("w2", "Chest Day", "2026-10-08T10:00:00Z"),
    ];
    const trackers = dayTrackers(workouts, [set("w1", 60, 10), set("w2", 60, 10)]);
    expect(trackers.map((t) => t.label).sort()).toEqual(["Chest Day", "Push A"]);
  });

  it("orders points oldest first within a day", () => {
    const workouts = [
      workout("w2", "Push A", "2026-10-08T10:00:00Z"),
      workout("w1", "Push A", "2026-10-01T10:00:00Z"),
    ];
    const points = dayTrackers(workouts, [set("w1", 60, 10), set("w2", 70, 10)])[0].points;
    expect(points.map((p) => p.total)).toEqual([600, 700]);
  });

  it("returns nothing when there is nothing finished", () => {
    expect(dayTrackers([], [])).toEqual([]);
  });
});

describe("formatTonnage", () => {
  it("shows the exact figure below ten thousand", () => {
    expect(formatTonnage(1800)).toBe("1,800");
    expect(formatTonnage(9999)).toBe("9,999");
  });

  it("abbreviates once the digits stop reading as a quantity", () => {
    expect(formatTonnage(12_900)).toBe("12.9k");
    expect(formatTonnage(10_000)).toBe("10k");
  });

  it("drops the decimal above a hundred thousand", () => {
    expect(formatTonnage(128_400)).toBe("128k");
  });
});

describe("tonnageFormatter", () => {
  it("keeps one format across a set that is read side by side", () => {
    // 8,420 next to 12.9k makes two days that differ by half look like they
    // are in different units.
    const format = tonnageFormatter([8420, 12_900, 7150]);
    expect(format(8420)).toBe("8.4k");
    expect(format(12_900)).toBe("12.9k");
  });

  it("stays exact when nothing in the set is big enough to abbreviate", () => {
    const format = tonnageFormatter([1800, 9400]);
    expect(format(1800)).toBe("1,800");
    expect(format(9400)).toBe("9,400");
  });

  it("drops the decimal for everything once the peak passes a hundred thousand", () => {
    const format = tonnageFormatter([12_900, 128_400]);
    expect(format(128_400)).toBe("128k");
    expect(format(12_900)).toBe("13k");
  });

  it("handles an empty set", () => {
    expect(tonnageFormatter([])(1800)).toBe("1,800");
  });
});

describe("niceAxis", () => {
  it("produces round ticks rather than the raw data range", () => {
    const { domain, ticks } = niceAxis([6800, 7200, 7050, 7900, 8420]);
    // Every tick is a round figure a reader can use as a reference point.
    for (const tick of ticks) expect(tick % 500).toBe(0);
    expect(domain[0]).toBeLessThanOrEqual(6800);
    expect(domain[1]).toBeGreaterThanOrEqual(8420);
  });

  it("does not anchor to zero when the data sits far above it", () => {
    // Anchoring here would squeeze the whole series into the top of the plot.
    const { domain } = niceAxis([6800, 8420]);
    expect(domain[0]).toBeGreaterThan(0);
  });

  it("keeps every point off the frame of the plot", () => {
    const values = [6800, 8420];
    const { domain } = niceAxis(values);
    expect(domain[0]).toBeLessThan(Math.min(...values));
    expect(domain[1]).toBeGreaterThan(Math.max(...values));
  });

  it("never goes negative, since a tonnage cannot be", () => {
    expect(niceAxis([100, 200])[`domain`][0]).toBeGreaterThanOrEqual(0);
  });

  it("opens a window around a flat history instead of collapsing", () => {
    const { domain } = niceAxis([2100, 2100]);
    expect(domain[1]).toBeGreaterThan(domain[0]);
  });

  it("is free of float drift in the tick values", () => {
    for (const tick of niceAxis([0.1, 0.7]).ticks) {
      expect(Number.isFinite(tick)).toBe(true);
      expect(String(tick)).not.toMatch(/\d{6,}$/);
    }
  });

  it("handles an empty set without throwing", () => {
    expect(niceAxis([]).ticks.length).toBeGreaterThan(0);
  });
});

describe("formatChange", () => {
  it("signs the percentage", () => {
    expect(formatChange(0.06)).toBe("+6%");
    expect(formatChange(-0.03)).toBe("-3%");
  });

  it("says level rather than +0%", () => {
    expect(formatChange(0.001)).toBe("level");
  });

  it("has nothing to say without a comparison", () => {
    expect(formatChange(null)).toBeNull();
  });
});
