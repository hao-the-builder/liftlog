import { describe, expect, it } from "vitest";
import { progressionHint, resolveIncrement, type WorkingSet } from "./progression";

const range = { repMin: 8, repMax: 12, increment: 2.5 };

describe("progressionHint", () => {
  it("asks for a starting load when there is no history", () => {
    const hint = progressionHint({ lastSession: [], ...range });
    expect(hint.kind).toBe("first-time");
    expect(hint.text).toContain("8 to 12");
  });

  it("adds the increment when every working set reached the top of the range", () => {
    const lastSession: WorkingSet[] = [
      { weight: 50, reps: 12 },
      { weight: 50, reps: 12 },
      { weight: 50, reps: 12 },
    ];
    const hint = progressionHint({ lastSession, ...range });
    expect(hint.kind).toBe("add-weight");
    if (hint.kind !== "add-weight") throw new Error("unreachable");
    expect(hint.targetWeight).toBe(52.5);
    expect(hint.previousWeight).toBe(50);
    expect(hint.text).toBe("Every set hit 12. Go up to 52.5 kg.");
  });

  it("counts sets above the top of the range as having reached it", () => {
    const lastSession: WorkingSet[] = [
      { weight: 50, reps: 13 },
      { weight: 50, reps: 12 },
    ];
    expect(progressionHint({ lastSession, ...range }).kind).toBe("add-weight");
  });

  it("holds the load and asks for one more rep when any set fell short", () => {
    const lastSession: WorkingSet[] = [
      { weight: 50, reps: 12 },
      { weight: 50, reps: 12 },
      { weight: 50, reps: 9 },
    ];
    const hint = progressionHint({ lastSession, ...range });
    expect(hint.kind).toBe("add-rep");
    if (hint.kind !== "add-rep") throw new Error("unreachable");
    expect(hint.setNumber).toBe(3);
    expect(hint.targetReps).toBe(10);
    expect(hint.targetWeight).toBe(50);
    expect(hint.text).toBe("Hold 50 kg. Beat set 3: 10 reps.");
  });

  it("points at the first set that fell short, not the worst one", () => {
    const lastSession: WorkingSet[] = [
      { weight: 50, reps: 10 },
      { weight: 50, reps: 6 },
    ];
    const hint = progressionHint({ lastSession, ...range });
    if (hint.kind !== "add-rep") throw new Error("expected add-rep");
    expect(hint.setNumber).toBe(1);
    expect(hint.targetReps).toBe(11);
  });

  it("ignores warm-ups when deciding", () => {
    const lastSession: WorkingSet[] = [
      { weight: 20, reps: 15, isWarmup: true },
      { weight: 50, reps: 12 },
      { weight: 50, reps: 12 },
    ];
    const hint = progressionHint({ lastSession, ...range });
    expect(hint.kind).toBe("add-weight");
    if (hint.kind !== "add-weight") throw new Error("unreachable");
    // The 20 kg warm-up must not become the progressed load.
    expect(hint.previousWeight).toBe(50);
  });

  it("ignores logged sets with zero reps", () => {
    const lastSession: WorkingSet[] = [
      { weight: 50, reps: 12 },
      { weight: 50, reps: 0 },
    ];
    expect(progressionHint({ lastSession, ...range }).kind).toBe("add-weight");
  });

  it("treats a session of nothing but warm-ups as no history", () => {
    const lastSession: WorkingSet[] = [{ weight: 20, reps: 15, isWarmup: true }];
    expect(progressionHint({ lastSession, ...range }).kind).toBe("first-time");
  });

  it("progresses from the heaviest working set when loads differ", () => {
    const lastSession: WorkingSet[] = [
      { weight: 50, reps: 12 },
      { weight: 47.5, reps: 12 },
    ];
    const hint = progressionHint({ lastSession, ...range });
    if (hint.kind !== "add-weight") throw new Error("expected add-weight");
    expect(hint.previousWeight).toBe(50);
    expect(hint.targetWeight).toBe(52.5);
  });

  it("uses whatever increment the user typed, not a hardcoded 2.5", () => {
    const lastSession: WorkingSet[] = [{ weight: 100, reps: 12 }];
    const hint = progressionHint({ lastSession, repMin: 8, repMax: 12, increment: 1.25 });
    if (hint.kind !== "add-weight") throw new Error("expected add-weight");
    expect(hint.targetWeight).toBe(101.25);
    expect(hint.increment).toBe(1.25);
  });

  it("renders the unit the user chose", () => {
    const lastSession: WorkingSet[] = [{ weight: 100, reps: 12 }];
    const hint = progressionHint({ lastSession, ...range, unit: "lb" });
    expect(hint.text).toContain("lb");
  });

  it("handles a single-set exercise", () => {
    const hint = progressionHint({ lastSession: [{ weight: 40, reps: 11 }], ...range });
    if (hint.kind !== "add-rep") throw new Error("expected add-rep");
    expect(hint.setNumber).toBe(1);
    expect(hint.targetReps).toBe(12);
  });
});

describe("resolveIncrement", () => {
  it("prefers the per-exercise override", () => {
    expect(resolveIncrement(5, 2.5)).toBe(5);
  });

  it("falls back to the profile default when unset", () => {
    expect(resolveIncrement(null, 2.5)).toBe(2.5);
    expect(resolveIncrement(undefined, 2.5)).toBe(2.5);
  });

  it("ignores a nonsensical override", () => {
    expect(resolveIncrement(0, 2.5)).toBe(2.5);
    expect(resolveIncrement(-5, 2.5)).toBe(2.5);
    expect(resolveIncrement(Number.NaN, 2.5)).toBe(2.5);
  });
});
