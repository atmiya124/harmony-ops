'use client';

import { Bar, BarChart, BarShapeProps, Cell, Rectangle, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART, ChartDatum, useChartAnimation } from './chartTheme';
import ChartTooltip from './ChartTooltip';
import ChartDataTable from './ChartDataTable';
import { formatCents } from '@/lib/money';

interface Props {
  data: ChartDatum[];
  label: string;
  // The period being read (usually the current one) is drawn in full ink;
  // the rest recede. Defaults to the last column.
  emphasisIndex?: number;
  height?: number;
  showAxis?: boolean;
  // Small right-aligned period name under the columns, e.g. 'Sep 2026'.
  caption?: string;
  formatValue?: (cents: number) => string;
}

// Thin rounded columns for a period-over-period glance — the "emphasis"
// pattern: one bar speaks, the others give it context.
export default function ColumnTrend({ data, label, emphasisIndex = data.length - 1, height = 72, showAxis = false, caption, formatValue = formatCents }: Props) {
  const animate = useChartAnimation();

  const fillFor = (i: number) => (i === emphasisIndex ? CHART.columnEmphasis : CHART.columnMuted);

  return (
    <div className="relative w-full">
      <BarChart
        responsive
        style={{ width: '100%', height }}
        data={data}
        margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
        barCategoryGap="28%"
        accessibilityLayer
      >
        <XAxis
          dataKey="label"
          hide={!showAxis}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          tick={{ fill: CHART.inkMuted, fontSize: CHART.axisFontSize }}
        />
        <YAxis hide domain={[0, (max: number) => max || 1]} />
        <Tooltip content={<ChartTooltip color={CHART.columnEmphasis} formatValue={formatValue} />} cursor={false} isAnimationActive={false} />
        <Bar
          dataKey="value"
          radius={[CHART.barRadius, CHART.barRadius, 0, 0]}
          maxBarSize={CHART.maxBarSize}
          minPointSize={2}
          activeBar={(props: BarShapeProps) => (
            <Rectangle {...props} fill={props.index === emphasisIndex ? CHART.columnEmphasis : CHART.columnHover} />
          )}
          isAnimationActive={animate}
          animationDuration={CHART.animationMs}
          animationEasing={CHART.animationEasing}
        >
          {data.map((d, i) => (
            <Cell key={`${d.label}-${i}`} fill={fillFor(i)} />
          ))}
        </Bar>
      </BarChart>
      {caption ? <p className="mt-1.5 text-right text-xs text-[var(--flat-text-faint)]">{caption}</p> : null}
      <ChartDataTable caption={label} data={data} formatValue={formatValue} />
    </div>
  );
}
