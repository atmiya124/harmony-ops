'use client';

import { Bar, BarChart, BarShapeProps, LabelList, Rectangle, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART, ChartDatum, useChartAnimation } from './chartTheme';
import ChartTooltip from './ChartTooltip';
import ChartDataTable from './ChartDataTable';
import { formatCents, formatCentsWhole } from '@/lib/money';

interface Props {
  data: ChartDatum[]; // already sorted the way it should read, largest first
  label: string;
  // One series → one color for every bar (categories are nominal; a ramp
  // would just re-encode bar length).
  color: string;
  labelWidth?: number;
  formatValue?: (cents: number) => string;
}

const ROW_HEIGHT = 34;
const MAX_LABEL_CHARS = 16;

// Horizontal ranked bars for "where did the money go" — by category, event
// or partner. Names on the left, value at each bar's tip.
export default function BreakdownBars({ data, label, color, labelWidth = 104, formatValue = formatCents }: Props) {
  const animate = useChartAnimation();
  const height = Math.max(1, data.length) * ROW_HEIGHT + 4;

  return (
    <div className="relative w-full">
      <BarChart
        responsive
        style={{ width: '100%', height }}
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 64, bottom: 0, left: 0 }}
        barCategoryGap={10}
        accessibilityLayer
      >
        <XAxis type="number" hide domain={[0, (max: number) => max || 1]} />
        <YAxis type="category" dataKey="label" width={labelWidth} axisLine={false} tickLine={false} tick={<CategoryTick />} />
        <Tooltip content={<ChartTooltip color={color} formatValue={formatValue} />} cursor={false} isAnimationActive={false} />
        <Bar
          dataKey="value"
          fill={color}
          radius={[0, CHART.barRadius, CHART.barRadius, 0]}
          maxBarSize={14}
          minPointSize={2}
          activeBar={(props: BarShapeProps) => <Rectangle {...props} fillOpacity={0.8} />}
          isAnimationActive={animate}
          animationDuration={CHART.animationMs}
          animationEasing={CHART.animationEasing}
        >
          <LabelList
            dataKey="value"
            position="right"
            offset={8}
            formatter={(v) => formatCentsWhole(Number(v))}
            style={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 11, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
      <ChartDataTable caption={label} data={data} formatValue={formatValue} />
    </div>
  );
}

// Left-aligned, truncated category name; the full name is in the tooltip
// and the hidden data table.
function CategoryTick({ y, payload }: { y?: number | string; payload?: { value: string } }) {
  const name = String(payload?.value ?? '');
  const shown = name.length > MAX_LABEL_CHARS ? `${name.slice(0, MAX_LABEL_CHARS - 1)}…` : name;
  return (
    <text x={0} y={Number(y)} dy={4} fill="rgba(255, 255, 255, 0.7)" fontSize={12} textAnchor="start">
      <title>{name}</title>
      {shown}
    </text>
  );
}
