import { describe, expect, it } from "vitest";
import {
  detectPrsAgainstHistory,
  primaryPr,
  summarisePrs,
  type HistorySet,
} from "./prs";

const history: HistorySet[] = [
  { weight: 50, reps: 8 },
  { weight: 50, reps: 9 },
  { weight: 52.5, reps: 6 },
  { weight: 20, reps: 15, isWarmup: true },
];

describe("summarisePrs", () => {
  it("folds history into the three records", () => {
    const prs = summarisePrs(history);
    expect(prs.bestWeight).toBe(52.5);
    expect(prs.bestRepsByWeight.get(50)).toBe(9);
    expect(prs.bestRepsByWeight.get(52.5)).toBe(6);
    // 50 * (1 + 9/30) = 65 beats 52.5 * (1 + 6/30) = 63
    expect(prs.bestE1RM).toBeCloseTo(65, 6);
  });

  it("excludes warm-ups from every record", () => {
    const prs = summarisePrs([{ weight: 200, reps: 10, isWarmup: true }]);
    expect(prs.bestWeight).toBeNull();
    expect(prs.bestE1RM).toBeNull();
    expect(prs.bestRepsByWeight.size).toBe(0);
  });

  it("reports no records for an empty history", () => {
    const prs = summarisePrs([]);
    expect(prs.bestWeight).toBeNull();
    expect(prs.bestE1RM).toBeNull();
  });

  it("still tracks weight when every set is too high-rep to estimate a 1RM", () => {
    const prs = summarisePrs([{ weight: 30, reps: 20 }]);
    expect(prs.bestWeight).toBe(30);
    expect(prs.bestE1RM).toBeNull();
  });
});

describe("detectPrsAgainstHistory", () => {
  it("flags a heaviest-weight record", () => {
    const hits = detectPrsAgainstHistory({ weight: 55, reps: 5 }, history);
    expect(hits).toContain("weight");
  });

  it("flags more reps at a load already used", () => {
    const hits = detectPrsAgainstHistory({ weight: 50, reps: 10 }, history);
    expect(hits).toContain("reps-at-weight");
  });

  it("does not flag reps-at-weight for a load never used before", () => {
    // 51 kg has no history, so "most reps at 51 kg" would be meaningless.
    const hits = detectPrsAgainstHistory({ weight: 51, reps: 1 }, history);
    expect(hits).not.toContain("reps-at-weight");
  });

  it("flags an estimated 1RM record", () => {
    // 50 * (1 + 10/30) = 66.67 beats the standing 65.
    const hits = detectPrsAgainstHistory({ weight: 50, reps: 10 }, history);
    expect(hits).toContain("e1rm");
  });

  it("can flag several records at once", () => {
    const hits = detectPrsAgainstHistory({ weight: 60, reps: 10 }, history);
    expect(hits).toEqual(expect.arrayContaining(["weight", "e1rm"]));
  });

  it("returns nothing for an ordinary set", () => {
    expect(detectPrsAgainstHistory({ weight: 45, reps: 8 }, history)).toEqual([]);
  });

  it("requires a strict improvement, not a tie", () => {
    expect(detectPrsAgainstHistory({ weight: 52.5, reps: 6 }, history)).toEqual([]);
    expect(detectPrsAgainstHistory({ weight: 50, reps: 9 }, history)).toEqual([]);
  });

  it("never flags a warm-up", () => {
    const hits = detectPrsAgainstHistory({ weight: 200, reps: 10, isWarmup: true }, history);
    expect(hits).toEqual([]);
  });

  it("treats the very first working set as a weight record", () => {
    const hits = detectPrsAgainstHistory({ weight: 40, reps: 10 }, []);
    expect(hits).toContain("weight");
    expect(hits).toContain("e1rm");
    expect(hits).not.toContain("reps-at-weight");
  });

  it("flags weight but not e1rm for a very high-rep set", () => {
    // 20 reps is past the Epley ceiling, so there is no estimate to beat.
    const hits = detectPrsAgainstHistory({ weight: 60, reps: 20 }, history);
    expect(hits).toContain("weight");
    expect(hits).not.toContain("e1rm");
  });

  it("ignores a zero-rep set", () => {
    expect(detectPrsAgainstHistory({ weight: 100, reps: 0 }, history)).toEqual([]);
  });
});

describe("primaryPr", () => {
  it("ranks heaviest above most reps above e1rm", () => {
    expect(primaryPr(["e1rm", "weight", "reps-at-weight"])).toBe("weight");
    expect(primaryPr(["e1rm", "reps-at-weight"])).toBe("reps-at-weight");
    expect(primaryPr(["e1rm"])).toBe("e1rm");
  });

  it("returns null when nothing was hit", () => {
    expect(primaryPr([])).toBeNull();
  });
});
