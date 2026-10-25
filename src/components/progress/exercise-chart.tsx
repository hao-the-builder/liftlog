"use client";

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
  ChartCard,
  ChartEmpty,
  ChartTooltip,
  axisProps,
  gridProps,
} from "@/components/charts/chart-chrome";
import type { SessionPoint } from "@/lib/logic/series";
import type { Unit } from "@/lib/types/database";

/**
 * Estimated 1RM and top-set weight, as two small multiples rather than one
 * two-series chart.
 *
 * They are different measures, so putting them on one plot would mean either
 * a second y-axis (which invents a correlation out of the arbitrary alignment
 * of two scales) or squashing both onto one scale where the smaller one goes
 * flat. Two short stacked charts also read better on a phone, and each needs
 * no legend because the title names the single series.
 */
export function ExerciseCharts({
  points,
  unit,
}: {
  points: SessionPoint[];
  unit: Unit;
}) {
  const withEstimate = points.filter((p) => p.e1rm !== null);

  return (
    <div className="space-y-3">
      <ChartCard
        title="Estimated 1RM"
        subtitle={`Epley, from the best set of each session. In ${unit}.`}
      >
        {withEstimate.length < 2 ? (
          <ChartEmpty>
            {points.length === 0
              ? "No sessions logged for this exercise yet."
              : "One session so far. A second one draws the line."}
          </ChartEmpty>
        ) : (
          <SessionLine
            points={withEstimate}
            unit={unit}
            valueOf={(p) => p.e1rm as number}
            tooltipLabel="Est. 1RM"
          />
        )}
      </ChartCard>

      <ChartCard title="Top set" subtitle={`Heaviest working set of each session. In ${unit}.`}>
        {points.length < 2 ? (
          <ChartEmpty>
            {points.length === 0
              ? "Log a set to start the chart."
              : "One session so far. A second one draws the line."}
          </ChartEmpty>
        ) : (
          <SessionLine
            points={points}
            unit={unit}
            valueOf={(p) => p.topWeight}
            tooltipLabel="Top set"
            showReps
          />
        )}
      </ChartCard>
    </div>
  );
}

function SessionLine({
  points,
  unit,
  valueOf,
  tooltipLabel,
  showReps = false,
}: {
  points: SessionPoint[];
  unit: Unit;
  valueOf: (point: SessionPoint) => number;
  tooltipLabel: string;
  showReps?: boolean;
}) {
  const data = points.map((p) => ({ ...p, value: valueOf(p) }));
  const last = data[data.length - 1];

  return (
    <div className="pt-3 pr-4 pb-2">
      {/* Height includes the x-axis band, so the card never grows an inner
          scrollbar to reveal its own tick labels. */}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTick}
            minTickGap={28}
            {...axisProps}
          />
          <YAxis
            width={38}
            domain={["auto", "auto"]}
            tickFormatter={(value: number) => String(Math.round(value))}
            {...axisProps}
          />
          <Tooltip
            cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as SessionPoint & { value: number };
              return (
                <ChartTooltip
                  title={new Date(point.t).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  rows={[
                    {
                      label: tooltipLabel,
                      value: `${round(point.value)} ${unit}`,
                    },
                    ...(showReps ? [{ label: "Reps", value: String(point.topReps) }] : []),
                  ]}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART.series}
            strokeWidth={2}
            // Markers appear once the series is short enough for them to be
            // readable rather than a solid band of dots.
            dot={data.length <= 20 ? { r: 3, fill: CHART.series, strokeWidth: 0 } : false}
            activeDot={{ r: 5, fill: CHART.series, stroke: "var(--color-surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* One direct label, on the value that matters: where you are now. */}
      {last && (
        <p className="px-4 pt-1 text-xs text-muted">
          Latest <span className="tnum font-semibold text-text">{round(last.value)}</span> {unit}
        </p>
      )}
    </div>
  );
}

function formatTick(value: number): string {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function round(value: number): string {
  return String(Math.round(value * 2) / 2);
}
