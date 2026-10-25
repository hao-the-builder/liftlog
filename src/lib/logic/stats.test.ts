import { describe, expect, it } from "vitest";
import { movingAverage, weeklyRateOfChange, type DatedValue } from "./stats";

const daily = (values: number[], startDay = 1): DatedValue[] =>
  values.map((value, i) => ({
    date: `2026-10-${String(startDay + i).padStart(2, "0")}`,
    value,
  }));

describe("movingAverage", () => {
  it("averages a flat series to the same value", () => {
    const out = movingAverage(daily([80, 80, 80, 80, 80, 80, 80]));
    expect(out.map((p) => p.average)).toEqual([80, 80, 80, 80, 80, 80, 80]);
  });

  it("warms up over the first days instead of dropping them", () => {
    const out = movingAverage(daily([80, 82]));
    expect(out[0].average).toBe(80);
    expect(out[0].samples).toBe(1);
    expect(out[1].average).toBe(81);
    expect(out[1].samples).toBe(2);
  });

  it("holds the window at the configured number of days", () => {
    // Eight daily points, 7-day window: the last point drops the first value.
    const out = movingAverage(daily([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(out[6].average).toBeCloseTo((1 + 2 + 3 + 4 + 5 + 6 + 7) / 7, 10);
    expect(out[7].average).toBeCloseTo((2 + 3 + 4 + 5 + 6 + 7 + 8) / 7, 10);
    expect(out[7].samples).toBe(7);
  });

  it("smooths a spike rather than following it", () => {
    const out = movingAverage(daily([80, 80, 80, 90, 80, 80, 80]));
    const last = out[out.length - 1];
    expect(last.value).toBe(80);
    expect(last.average).toBeGreaterThan(80);
    expect(last.average).toBeLessThan(82);
  });

  it("measures the window in days, not in samples, so gaps behave", () => {
    // Two weigh-ins eight days apart: the second cannot see the first.
    const out = movingAverage([
      { date: "2026-10-01", value: 80 },
      { date: "2026-10-09", value: 90 },
    ]);
    expect(out[1].samples).toBe(1);
    expect(out[1].average).toBe(90);
  });

  it("sorts an out-of-order series before averaging", () => {
    const out = movingAverage([
      { date: "2026-10-03", value: 82 },
      { date: "2026-10-01", value: 80 },
      { date: "2026-10-02", value: 81 },
    ]);
    expect(out.map((p) => p.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(out[2].average).toBe(81);
  });

  it("honours a custom window", () => {
    const out = movingAverage(daily([1, 2, 3, 4, 5]), 3);
    expect(out[4].average).toBe(4); // (3 + 4 + 5) / 3
  });

  it("returns an empty series for no input", () => {
    expect(movingAverage([])).toEqual([]);
  });

  it("drops unusable points", () => {
    const out = movingAverage([
      { date: "2026-10-01", value: 80 },
      { date: "garbage", value: 81 },
      { date: "2026-10-02", value: Number.NaN },
    ]);
    expect(out).toHaveLength(1);
  });
});

describe("weeklyRateOfChange", () => {
  it("reports a steady loss as a negative percentage per week", () => {
    // 0.1 kg per day from 80, so 0.7 kg per week, a little under 1% of 80.
    const series = daily(Array.from({ length: 21 }, (_, i) => 80 - i * 0.1));
    const trend = weeklyRateOfChange(series);
    expect(trend).not.toBeNull();
    expect(trend!.absolutePerWeek).toBeCloseTo(-0.7, 6);
    expect(trend!.percentPerWeek).toBeLessThan(0);
    expect(trend!.percentPerWeek).toBeGreaterThan(-1.2);
  });

  it("reports a gain as positive", () => {
    const series = daily(Array.from({ length: 21 }, (_, i) => 70 + i * 0.05));
    const trend = weeklyRateOfChange(series);
    expect(trend!.absolutePerWeek).toBeCloseTo(0.35, 6);
    expect(trend!.percentPerWeek).toBeGreaterThan(0);
  });

  it("reports no change for a flat series", () => {
    const trend = weeklyRateOfChange(daily(Array.from({ length: 21 }, () => 80)));
    expect(trend!.absolutePerWeek).toBeCloseTo(0, 10);
    expect(trend!.percentPerWeek).toBeCloseTo(0, 10);
  });

  it("refuses to call a trend from a single weigh-in", () => {
    expect(weeklyRateOfChange(daily([80]))).toBeNull();
  });

  it("refuses to call a trend from too short a span", () => {
    // Three consecutive days is noise, not a direction.
    expect(weeklyRateOfChange(daily([80, 80.5, 81]))).toBeNull();
  });

  it("reports the span it actually used", () => {
    const series = daily(Array.from({ length: 21 }, (_, i) => 80 - i * 0.1));
    const trend = weeklyRateOfChange(series);
    expect(trend!.spanDays).toBe(14);
  });

  it("returns null for an empty series", () => {
    expect(weeklyRateOfChange([])).toBeNull();
  });
});
