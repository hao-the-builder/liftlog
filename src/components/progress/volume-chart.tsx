"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART,
  ChartCard,
  ChartEmpty,
  ChartLegend,
  ChartTooltip,
  axisProps,
  gridProps,
} from "@/components/charts/chart-chrome";
import {
  WEEKLY_TARGET_MAX,
  WEEKLY_TARGET_MIN,
  type MuscleComparison,
} from "@/lib/logic/volume";
import { MUSCLE_ORDER } from "@/lib/muscles";

/**
 * Weekly sets per muscle, this week against last.
 *
 * Two series of the same measure at two times, so they are an ordinal pair
 * rather than two identities: this week is the solid fill and last week is an
 * outline behind it. In a black, silver and white palette the recession has to
 * come from mark form, because a grey dark enough to read as "behind" is also
 * dark enough to vanish into the pane. The 10 to 20 band sits behind both as a
 * surface tint, not as a third series, because it is context rather than data.
 */
export function VolumeChart({
  rows,
  action,
}: {
  rows: MuscleComparison[];
  action?: React.ReactNode;
}) {
  const data = [...rows].sort(
    (a, b) => MUSCLE_ORDER.indexOf(a.muscle) - MUSCLE_ORDER.indexOf(b.muscle),
  );

  const peak = Math.max(WEEKLY_TARGET_MAX, ...data.map((r) => Math.max(r.thisWeek, r.lastWeek)));

  return (
    <ChartCard
      title="Weekly sets per muscle"
      subtitle="A direct set counts 1, a secondary muscle counts a half."
      action={action}
    >
      {data.length === 0 ? (
        <ChartEmpty>Nothing logged in the last two weeks.</ChartEmpty>
      ) : (
        <>
          <ChartLegend
            items={[
              { label: "This week", color: CHART.series },
              { label: "Last week", color: CHART.seriesDim, outline: true },
            ]}
          />
          <div className="pr-4 pb-2">
            <ResponsiveContainer width="100%" height={Math.max(220, data.length * 30 + 40)}>
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 4, right: 20, bottom: 4, left: 0 }}
                barGap={2}
              >
                {/* The target band goes first so it sits behind the grid and
                    the bars. Rendered faintly on purpose: it is context, and at
                    full strength it reads as a panel rather than a range. */}
                <ReferenceArea
                  x1={WEEKLY_TARGET_MIN}
                  x2={WEEKLY_TARGET_MAX}
                  fill={CHART.series}
                  fillOpacity={0.07}
                  ifOverflow="extendDomain"
                />
                <CartesianGrid {...gridProps} vertical horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, Math.ceil(peak / 5) * 5]}
                  allowDecimals={false}
                  {...axisProps}
                />
                <YAxis
                  type="category"
                  dataKey="muscle"
                  width={88}
                  interval={0}
                  {...axisProps}
                  tick={{ fill: "var(--color-muted)", fontSize: 11 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-2)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as MuscleComparison;
                    return (
                      <ChartTooltip
                        title={row.muscle}
                        rows={[
                          { label: "This week", value: `${row.thisWeek} sets` },
                          { label: "Last week", value: `${row.lastWeek} sets` },
                        ]}
                      />
                    );
                  }}
                />
                {/* Last week is an outline, not a fill. A monochrome fill dark
                    enough to recede behind this week lands at 1.66:1 against
                    the pane and disappears, so the recession is carried by
                    mark form instead of by lightness. */}
                <Bar
                  dataKey="lastWeek"
                  name="Last week"
                  fill="none"
                  stroke={CHART.seriesDim}
                  strokeWidth={1.5}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="thisWeek"
                  name="This week"
                  fill={CHART.series}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="px-4 pb-4 text-xs text-faint">
            The shaded band is <span className="tnum">{WEEKLY_TARGET_MIN}</span> to{" "}
            <span className="tnum">{WEEKLY_TARGET_MAX}</span> sets, the range most lifters
            grow in.
          </p>
        </>
      )}
    </ChartCard>
  );
}

/**
 * The table twin. Every value in the chart is readable here too, so no number
 * is reachable only by hovering.
 */
export function VolumeTable({ rows }: { rows: MuscleComparison[] }) {
  const data = [...rows].sort(
    (a, b) => MUSCLE_ORDER.indexOf(a.muscle) - MUSCLE_ORDER.indexOf(b.muscle),
  );
  if (data.length === 0) return null;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs text-faint">
          <th scope="col" className="px-4 py-2 font-medium">
            Muscle
          </th>
          <th scope="col" className="px-2 py-2 text-right font-medium">
            This week
          </th>
          <th scope="col" className="px-4 py-2 text-right font-medium">
            Last week
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {data.map((row) => (
          <tr key={row.muscle}>
            <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted">
              {row.muscle}
            </th>
            <td className="tnum px-2 py-2.5 text-right font-medium text-text">
              {row.thisWeek}
            </td>
            <td className="tnum px-4 py-2.5 text-right text-muted">{row.lastWeek}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
