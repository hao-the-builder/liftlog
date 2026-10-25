"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
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
import type { SmoothedPoint } from "@/lib/logic/stats";
import type { Unit } from "@/lib/types/database";

/**
 * Bodyweight: the daily readings and the trailing average through them.
 *
 * The average is the series that matters, so it is the brighter step and the
 * only one drawn as a line; the raw weigh-ins recede to small dots behind it.
 * Same hue, two steps, because these are the same measurement rather than
 * two identities.
 */
export function BodyweightChart({
  points,
  unit,
  windowDays,
}: {
  points: SmoothedPoint[];
  unit: Unit;
  windowDays: number;
}) {
  const data = points.map((p) => ({
    ...p,
    t: new Date(`${p.date}T00:00:00`).getTime(),
  }));

  return (
    <ChartCard
      title="Bodyweight"
      subtitle={`Each weigh-in, and the ${windowDays}-day average through them.`}
    >
      {data.length < 2 ? (
        <ChartEmpty>
          {data.length === 0
            ? "No weigh-ins yet. Add today's below."
            : "One weigh-in so far. A few more and the trend appears."}
        </ChartEmpty>
      ) : (
        <>
          <ChartLegend
            items={[
              { label: `${windowDays}-day average`, color: CHART.series },
              { label: "Weigh-in", color: CHART.seriesDim },
            ]}
          />
          <div className="pr-4 pb-2">
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(value: number) =>
                    new Date(value).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                    })
                  }
                  minTickGap={28}
                  {...axisProps}
                />
                <YAxis
                  width={42}
                  domain={["auto", "auto"]}
                  tickFormatter={(value: number) => value.toFixed(1)}
                  {...axisProps}
                />
                <Tooltip
                  cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as SmoothedPoint & { t: number };
                    return (
                      <ChartTooltip
                        title={new Date(point.t).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                        rows={[
                          { label: "Weigh-in", value: `${point.value.toFixed(1)} ${unit}` },
                          { label: "Average", value: `${point.average.toFixed(1)} ${unit}` },
                        ]}
                      />
                    );
                  }}
                />
                <Scatter dataKey="value" fill={CHART.seriesDim} shape="circle" r={3} isAnimationActive={false} />
                <Line
                  type="monotone"
                  dataKey="average"
                  stroke={CHART.series}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: CHART.series,
                    stroke: "var(--color-surface)",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ChartCard>
  );
}
