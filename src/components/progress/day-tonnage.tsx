"use client";

import { useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowRight, ArrowUp } from "@phosphor-icons/react/dist/ssr";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART,
  ChartEmpty,
  ChartTooltip,
  axisProps,
  gridProps,
} from "@/components/charts/chart-chrome";
import { Sheet } from "@/components/ui/sheet";
import {
  formatChange,
  niceAxis,
  tonnageFormatter,
  type DayTracker,
  type TonnagePoint,
} from "@/lib/logic/tonnage";
import type { Unit } from "@/lib/types/database";

/**
 * Total weight moved, one tracker per workout day.
 *
 * Each card is a day's own history, because the only honest comparison for a
 * Push A is the previous Push A. A grid rather than a selector: on a six-day
 * split the question is usually "which of my days is stalling", and that is a
 * question about all of them at once.
 *
 * Direction is carried by an arrow glyph, not by colour. There is no green in
 * this palette and red is reserved for destructive actions, so a lighter
 * session reads as recessive silver rather than as an error — which is also
 * more honest, since one lighter day is not a failure.
 */
export function DayTonnageGrid({
  trackers,
  unit,
}: {
  trackers: DayTracker[];
  unit: Unit;
}) {
  const [open, setOpen] = useState<DayTracker | null>(null);

  // One format across every card: these are read against each other, so the
  // largest value decides how all of them are written.
  const format = tonnageFormatter(trackers.map((t) => t.latest));

  if (trackers.length === 0) {
    return (
      <section className="pane rounded-surface">
        <header className="px-4 pt-4">
          <h2 className="text-base font-normal tracking-tight text-text">Total weight moved</h2>
          <p className="mt-1 text-xs text-muted">
            Each workout day tracked against the last time you trained it.
          </p>
        </header>
        <ChartEmpty>Finish a workout and its day shows up here.</ChartEmpty>
      </section>
    );
  }

  return (
    <>
      <section>
        <header className="px-1 pb-3">
          <h2 className="text-base font-normal tracking-tight text-text">Total weight moved</h2>
          <p className="mt-1 text-xs text-muted">
            Each day against the last time you trained it. Working sets only, in {unit}.
          </p>
        </header>

        {/* auto-fit rather than a fixed column count: two up on a phone, more
            on a wide screen, and a lone tracker does not stretch to full width
            and stop reading as a card. */}
        <ul
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(9.5rem, 1fr))" }}
        >
          {/* Keyed on the day name rather than the label, so a template that
              happens to be called "Unplanned" cannot collide with the ad-hoc
              bucket. */}
          {trackers.map((tracker) => (
            <li key={tracker.dayName === null ? "\u0000unplanned" : `day:${tracker.dayName}`}>
              <DayCard
                tracker={tracker}
                unit={unit}
                format={format}
                onOpen={() => setOpen(tracker)}
              />
            </li>
          ))}
        </ul>
      </section>

      <Sheet
        open={open !== null}
        title={open?.label ?? ""}
        onClose={() => setOpen(null)}
      >
        {open && <DayDetail tracker={open} unit={unit} />}
      </Sheet>
    </>
  );
}

function DayCard({
  tracker,
  unit,
  format,
  onOpen,
}: {
  tracker: DayTracker;
  unit: Unit;
  format: (total: number) => string;
  onOpen: () => void;
}) {
  const change = formatChange(tracker.change);
  const sessions = tracker.points.length;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${tracker.label}, ${format(tracker.latest)} ${unit}${
        change ? `, ${change} on the previous session` : ""
      }. Open the full trend.`}
      className={clsx(
        "pane w-full rounded-surface px-3.5 pt-3 pb-3.5 text-left",
        "transition-[border-color,background-color] duration-150 ease-out",
        "hover:border-line-strong active:scale-[0.99]",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-label font-light uppercase text-faint">
          {tracker.label}
        </span>
        <ArrowRight size={11} className="shrink-0 text-faint" />
      </span>

      <Sparkline points={tracker.points} />

      <span className="mt-2 flex items-baseline gap-1">
        {/* Display figures stay in the sans: the mono at this size splits a
            decimal into "57 . 5" with a visible gap around the point. */}
        <span className="text-[1.625rem] font-light leading-none tracking-tight text-text">
          {format(tracker.latest)}
        </span>
        <span className="font-mono text-[10px] font-light uppercase tracking-[0.14em] text-faint">
          {unit}
        </span>
      </span>

      <span className="mt-1.5 flex items-center gap-1">
        <ChangeMark change={tracker.change} />
        <span
          className={clsx(
            "font-mono text-[10px] font-light tracking-[0.08em]",
            tracker.change !== null && tracker.change > 0 ? "text-text" : "text-faint",
          )}
        >
          {change ?? `${sessions === 1 ? "first session" : "no comparison"}`}
        </span>
      </span>
    </button>
  );
}

/**
 * The direction glyph.
 *
 * This exists so direction is never carried by colour alone — there is no
 * green here to carry "up", and red is spoken for.
 */
function ChangeMark({ change }: { change: number | null }) {
  if (change === null) return <span aria-hidden="true" className="h-2.5 w-2.5" />;
  if (change > 0) {
    return <ArrowUp aria-hidden="true" size={10} weight="bold" className="text-text" />;
  }
  if (change < 0) {
    return <ArrowDown aria-hidden="true" size={10} weight="bold" className="text-faint" />;
  }
  return <span aria-hidden="true" className="h-px w-2.5 bg-faint" />;
}

/**
 * A day's history at card size.
 *
 * No axes and no labels: at this size it is a shape, not a reading, and the
 * exact figures are directly below it and in the detail sheet. The most recent
 * point is marked because "where am I now" is the one value the shape cannot
 * tell you on its own.
 */
function Sparkline({ points }: { points: TonnagePoint[] }) {
  const width = 100;
  const height = 28;
  const pad = 2;

  // A single session has no shape yet. Drawn as a dashed rule rather than a
  // solid one so it cannot be mistaken for a flat history, which is a real
  // reading and a solid line.
  if (points.length < 2) {
    return (
      <span aria-hidden="true" className="mt-2.5 flex h-7 w-full items-center">
        <span
          className="h-px w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, var(--color-line-strong) 0 3px, transparent 3px 7px)",
          }}
        />
      </span>
    );
  }

  const totals = points.map((p) => p.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  // A history with no variation at all has no range to scale against. Drawn
  // naively it pins to the bottom edge, which reads as "went to zero" rather
  // than "did not change", so a flat history is drawn down the middle.
  const flat = max === min;
  const span = flat ? 1 : max - min;

  const x = (i: number) => (i / (points.length - 1)) * (width - pad * 2) + pad;
  const y = (value: number) =>
    flat ? height / 2 : height - pad - ((value - min) / span) * (height - pad * 2);

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.total)}`).join(" ");
  const lastX = x(points.length - 1);
  const lastY = y(totals[totals.length - 1]);

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-2.5 h-7 w-full overflow-visible"
    >
      <path
        d={path}
        fill="none"
        stroke={CHART.series}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={CHART.seriesEmit} />
    </svg>
  );
}

/**
 * The full trend for one day, with the table twin beneath it.
 *
 * Every value in the chart is readable as text here, so no number in this app
 * is reachable only by hovering a mark.
 */
function DayDetail({ tracker, unit }: { tracker: DayTracker; unit: Unit }) {
  const data = tracker.points;
  const totals = data.map((p) => p.total);

  // One formatter for the axis and the tooltip together, so the ticks cannot
  // read "10k, 7,500, 5,000" with two different conventions stacked up one
  // axis.
  const format = tonnageFormatter(totals);

  /**
   * The axis fits the data instead of starting at zero.
   *
   * A zero baseline is mandatory when the length of a mark encodes the value,
   * which is why the bars elsewhere in this app keep theirs. Here the value is
   * encoded by the line's position, and anchoring to zero pushes a real 24%
   * climb into the top sliver of the plot where it reads as flat — which is
   * its own kind of lie about the data. The axis is labelled with real figures
   * and the card states the change as a percentage, so the magnitude never
   * rests on slope alone.
   */
  const { domain, ticks } = niceAxis(totals);

  return (
    <div className="px-4 pb-4">
      <p className="pt-1 pb-3 text-xs text-muted">
        Weight times reps over the working sets of each session, in {unit}. Warm-ups are not
        counted.
      </p>

      {data.length < 2 ? (
        <ChartEmpty>
          One session so far. The next {tracker.label} draws the line.
        </ChartEmpty>
      ) : (
        <div className="pr-2">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data} margin={{ top: 8, right: 10, bottom: 4, left: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) =>
                  new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                }
                {...axisProps}
              />
              <YAxis
                width={48}
                domain={domain}
                ticks={ticks}
                tickFormatter={(v: number) => format(v)}
                {...axisProps}
              />
              <Tooltip
                cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as TonnagePoint;
                  return (
                    <ChartTooltip
                      title={new Date(point.t).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      rows={[
                        // The tooltip is the place to be exact: the axis is
                        // abbreviated for scanning, this is the real figure.
                        {
                          label: "Total",
                          value: `${Math.round(point.total).toLocaleString("en-US")} ${unit}`,
                        },
                        { label: "Working sets", value: String(point.sets) },
                      ]}
                    />
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke={CHART.series}
                strokeWidth={2}
                dot={{ r: 3, fill: CHART.series, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: CHART.seriesEmit, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left font-mono text-[10px] font-light uppercase tracking-[0.18em] text-faint">
            <th scope="col" className="py-2 font-light">
              Session
            </th>
            <th scope="col" className="py-2 text-right font-light">
              Sets
            </th>
            <th scope="col" className="py-2 text-right font-light">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[...data].reverse().map((point) => (
            <tr key={point.workoutId}>
              <th scope="row" className="py-2.5 text-left font-light text-muted">
                {new Date(point.t).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </th>
              <td className="tnum py-2.5 text-right text-muted">{point.sets}</td>
              <td className="tnum py-2.5 text-right font-medium text-text">
                {Math.round(point.total).toLocaleString("en-US")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
