'use client';

import { useId } from 'react';
import { Area, AreaChart, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART, ChartDatum, useChartAnimation } from './chartTheme';
import ChartTooltip from './ChartTooltip';
import ChartDataTable from './ChartDataTable';
import { formatCents } from '@/lib/money';

interface Props {
  data: ChartDatum[];
  color: string;
  // Names the series for the hidden data table / screen readers.
  label: string;
  height?: number;
  // `sparkline`: no axes, for stat cards. `full`: sparse x-axis ticks.
  variant?: 'sparkline' | 'full';
  formatValue?: (cents: number) => string;
}

// Smooth monotone line with a fading gradient wash. Hovering (or dragging a
// finger) snaps a crosshair to the nearest point and shows its value.
export default function AreaTrend({ data, color, label, height = 64, variant = 'sparkline', formatValue = formatCents }: Props) {
  const animate = useChartAnimation();
  // useId output can contain characters that break `url(#…)` references.
  const gradientId = `area-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const full = variant === 'full';

  return (
    <div className="relative w-full">
      <AreaChart
        responsive
        style={{ width: '100%', height }}
        data={data}
        margin={{ top: 6, right: 4, bottom: full ? 0 : 2, left: 4 }}
        accessibilityLayer
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={CHART.areaTopOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={CHART.areaBottomOpacity} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          hide={!full}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
          tick={{ fill: CHART.inkMuted, fontSize: CHART.axisFontSize }}
          tickMargin={6}
        />
        {/* Hidden, but pins the baseline at zero so the fill never implies a
            negative dip; the small top pad keeps the peak off the card edge. */}
        <YAxis hide domain={[0, (max: number) => max * 1.08 || 1]} />
        <Tooltip
          content={<ChartTooltip color={color} formatValue={formatValue} />}
          cursor={{ stroke: CHART.crosshair, strokeWidth: 1 }}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={CHART.lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: CHART.dotRadius, fill: color, stroke: CHART.surface, strokeWidth: 2 }}
          isAnimationActive={animate}
          animationDuration={CHART.animationMs}
          animationEasing={CHART.animationEasing}
        />
      </AreaChart>
      <ChartDataTable caption={label} data={data} formatValue={formatValue} />
    </div>
  );
}
