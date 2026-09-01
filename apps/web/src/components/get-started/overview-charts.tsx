"use client";

import { useId, useState } from "react";

import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OverviewCharts } from "@/server/services/overview.service";

/**
 * The two figures below the websites table.
 *
 * Built as inline SVG rather than pulled from a charting library: both are a single series of
 * at most a few dozen points, the app has no charting dependency today, and adding one for
 * this would ship a large bundle to every page for two small pictures.
 *
 * Colour is one hue per chart, taken from the validated categorical palette — blue for
 * visitors, green for conversions — with a dark step for each, checked against both surfaces
 * (lightness band, chroma floor, and ≥3:1 contrast all pass in light and dark). Neither chart
 * has a second series, so identity never rests on colour: the title names the measure, and
 * every bar carries a direct label.
 */

/** Palette slot 1 (blue) and slot 6 (green), light/dark steps. */
const VISITOR_COLOR = "text-[#2a78d6] dark:text-[#3987e5]";
const CONVERSION_COLOR = "text-[#008300] dark:text-[#008300]";

function CardShell({
  title,
  value,
  aside,
  meta,
  children,
  className,
}: {
  title: string;
  value: string;
  aside?: React.ReactNode;
  meta: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="truncate text-sm font-semibold">{title}</h3>
        {aside}
      </div>

      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-right text-xs text-muted-foreground tabular-nums">{meta}</p>

      <div className="mt-3 min-h-[9rem] flex-1">{children}</div>
    </section>
  );
}

/** The placeholder texture shown where a chart would be, when there is nothing to draw. */
function EmptyPlot({ message }: { message: string }) {
  const id = useId();

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-center justify-center">
        <svg
          viewBox="0 0 260 170"
          className="h-full max-h-[10.5rem] w-full max-w-[16rem] text-muted-foreground/25"
          aria-hidden
          role="presentation"
        >
          <defs>
            <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="3.4" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="260" height="170" fill={`url(#${id})`} />
        </svg>
      </div>
      <p className="border-t border-border/70 pt-3 text-center text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  );
}

/**
 * Conversions per running experiment.
 *
 * Horizontal bars: the categories are experiment names, which are long and of uneven length,
 * and a horizontal axis gives them room to be read rather than rotated.
 */
function ConversionBars({ data }: { data: OverviewCharts["conversionsByExperiment"] }) {
  const max = Math.max(...data.map((row) => row.conversions), 1);

  return (
    <ul className="space-y-3">
      {data.map((row) => (
        <li key={row.experimentId} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm" title={row.name}>
              {row.name}
            </span>
            {/* Direct label on every bar: with one series there is no legend, and a value the
             * reader has to estimate off an axis is a value they will estimate wrongly. */}
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {formatNumber(row.conversions)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-current", CONVERSION_COLOR)}
              style={{
                width: `${Math.max((row.conversions / max) * 100, row.conversions > 0 ? 3 : 0)}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Unique visitors per day.
 *
 * An area chart with a 2px line: a continuous measure over evenly spaced days, where the shape
 * of the trend is the point and individual days are read on hover rather than from labels.
 */
function VisitorArea({ data }: { data: OverviewCharts["visitorTrend"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();

  const W = 600;
  const H = 150;
  const PAD = 6;
  const max = Math.max(...data.map((day) => day.visitors), 1);
  const step = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0;

  const x = (index: number) => PAD + index * step;
  const y = (value: number) => H - PAD - (value / max) * (H - PAD * 2);

  const line = data
    .map((day, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(day.visitors)}`)
    .join(" ");
  const area = `${line} L${x(data.length - 1)},${H} L${x(0)},${H} Z`;

  const active = hover === null ? null : data[hover];

  return (
    <div className="relative flex h-full flex-col">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={cn("h-full max-h-[10.5rem] w-full", VISITOR_COLOR)}
        role="img"
        aria-label={`Unique visitors per day over the last ${data.length} days`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />

        {active ? (
          <>
            <line
              x1={x(hover!)}
              y1={PAD}
              x2={x(hover!)}
              y2={H}
              stroke="currentColor"
              strokeWidth="1"
              strokeOpacity="0.35"
            />
            {/* 2px surface ring so the marker stays visible over the area fill. */}
            <circle
              cx={x(hover!)}
              cy={y(active.visitors)}
              r="5"
              fill="currentColor"
              stroke="var(--card)"
              strokeWidth="2"
            />
          </>
        ) : null}

        {/* Hit targets far wider than the 2px line, so a day is easy to land on. */}
        {data.map((day, index) => (
          <rect
            key={day.date.toISOString()}
            x={x(index) - step / 2}
            y={0}
            width={Math.max(step, 8)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}
      </svg>

      <p className="pt-2 text-center text-xs text-muted-foreground" aria-live="polite">
        {active
          ? `${active.date.toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${formatNumber(active.visitors)} unique visitor${active.visitors === 1 ? "" : "s"}`
          : `Last ${data.length} days`}
      </p>
    </div>
  );
}

export function OverviewChartCards({ charts }: { charts: OverviewCharts }) {
  const hasConversions = charts.conversionsByExperiment.length > 0;
  const hasVisitors = charts.visitorTotal > 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <CardShell
        title="Conversions by running experiment"
        value={formatNumber(charts.conversionsTotal)}
        meta={String(charts.year)}
      >
        {hasConversions ? (
          <ConversionBars data={charts.conversionsByExperiment} />
        ) : (
          <EmptyPlot message="No conversions recorded yet." />
        )}
      </CardShell>

      <CardShell
        title="Visitors over time"
        value={formatNumber(charts.visitorTotal)}
        meta={`${charts.visitorDailyAverage.toFixed(charts.visitorDailyAverage < 10 ? 1 : 0)} avg/day`}
        aside={
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <span aria-hidden className={cn("size-1.5 rounded-full bg-current", VISITOR_COLOR)} />
            Unique visitors
          </span>
        }
      >
        {hasVisitors ? (
          <VisitorArea data={charts.visitorTrend} />
        ) : (
          <EmptyPlot
            message={`No experiment traffic recorded in the last ${charts.trendDays} days.`}
          />
        )}
      </CardShell>
    </div>
  );
}
