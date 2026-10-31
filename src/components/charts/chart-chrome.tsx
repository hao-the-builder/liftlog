"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

/**
 * Shared chart chrome.
 *
 * One place for the recessive grid colour, the axis styling and the tooltip,
 * so every chart in the app reads as one system rather than three Recharts
 * defaults. Values here match the design tokens; the series colours come from
 * --color-chart and --color-chart-dim, which were checked with the data-viz
 * validator against the chart surface.
 */

export const CHART = {
  /** The solid fill. The prominent half of an ordinal pair. */
  series: "var(--color-chart)",
  /**
   * The recessive half, and a STROKE rather than a fill. A monochrome fill
   * dark enough to sit a clear step below `series` lands at 1.66:1 against the
   * pane, which is invisible, so the recessive series is drawn as an outline
   * instead and told apart by mark form. Use it as `stroke`, never as `fill`.
   */
  seriesDim: "var(--color-chart-dim)",
  /** The top of the ramp. Reserved for the value being read right now. */
  seriesEmit: "var(--color-chart-emit)",
  grid: "var(--color-line)",
  axis: "var(--color-faint)",
  band: "var(--color-surface-3)",
} as const;

/** Hairline, solid, one shade off the surface. Never dashed. */
export const gridProps = {
  stroke: CHART.grid,
  strokeWidth: 1,
  vertical: false,
} as const;

export const axisProps = {
  stroke: CHART.grid,
  tick: { fill: "var(--color-faint)", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("pane rounded-surface", className)}>
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <h2 className="text-base font-normal tracking-tight text-text">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

interface TooltipRow {
  label: string;
  value: string;
}

/**
 * The app's tooltip. It floats over the plot, which is one of the few places
 * that genuinely has content behind it, so this is a blurred pane.
 */
export function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="pane-blur rounded-ctl border border-line-strong px-3 py-2 shadow-lg">
      <p className="text-[11px] text-muted">{title}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-baseline gap-3 text-xs">
            <span className="text-muted">{row.label}</span>
            <span className="tnum ml-auto font-medium text-text">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** An empty state shaped like the chart it replaces, so nothing jumps. */
export function ChartEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[180px] items-center justify-center px-6 text-center">
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}

/**
 * Legend swatches. Required whenever a chart draws two or more series.
 *
 * The swatch has to match the MARK, not just its colour. Since the recessive
 * series in this design is an outline rather than a fill, its swatch is an
 * outline too — a filled swatch next to an outlined bar is a legend that
 * describes a chart the user is not looking at.
 */
export function ChartLegend({
  items,
}: {
  items: { label: string; color: string; outline?: boolean }[];
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-[2px]"
            style={
              item.outline
                ? { border: `1.5px solid ${item.color}` }
                : { backgroundColor: item.color }
            }
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
