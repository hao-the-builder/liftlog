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
 * Two series of the same measure at two times, so they are an ordinal pair of
 * one hue rather than two identities: the current week is the brighter step
 * and last week recedes behind it. The 10 to 20 band sits behind the bars as
 * a surface tint, not as a third series, because it is context rather than
 * data.
 */
export function VolumeChart({ rows }: { rows: MuscleComparison[] }) {
  const data = [...rows].sort(
    (a, b) => MUSCLE_ORDER.indexOf(a.muscle) - MUSCLE_ORDER.indexOf(b.muscle),
  );

  const peak = Math.max(WEEKLY_TARGET_MAX, ...data.map((r) => Math.max(r.thisWeek, r.lastWeek)));

  return (
    <ChartCard
      title="Weekly sets per muscle"
      subtitle="A direct set counts 1, a secondary muscle counts a half."
    >
      {data.length === 0 ? (
        <ChartEmpty>Nothing logged in the last two weeks.</ChartEmpty>
      ) : (
        <>
          <ChartLegend
            items={[
              { label: "This week", color: CHART.series },
              { label: "Last week", color: CHART.seriesDim },
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
                <CartesianGrid {...gridProps} vertical horizontal={false} />
                {/* The target band, behind everything, as structure. */}
                <ReferenceArea
                  x1={WEEKLY_TARGET_MIN}
                  x2={WEEKLY_TARGET_MAX}
                  fill={CHART.band}
                  fillOpacity={1}
                  ifOverflow="extendDomain"
                />
                <XAxis
                  type="number"
                  domain={[0, Math.ceil(peak / 5) * 5]}
                  allowDecimals={false}
                  {...axisProps}
                />
                <YAxis
                  type="category"
                  dataKey="muscle"
                  width={78}
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
                <Bar
                  dataKey="lastWeek"
                  name="Last week"
                  fill={CHART.seriesDim}
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
            <td className="tnum px-2 py-2.5 text-right font-semibold text-text">
              {row.thisWeek}
            </td>
            <td className="tnum px-4 py-2.5 text-right text-muted">{row.lastWeek}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
