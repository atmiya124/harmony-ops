'use client';

import type { TooltipContentProps } from 'recharts';
import { formatCents } from '@/lib/money';

interface Props extends Partial<TooltipContentProps<number, string>> {
  color: string;
  formatValue?: (cents: number) => string;
}

// Shared tooltip body: the value leads (it's what the reader is after), the
// period/category follows in muted ink, keyed by a short stroke of the
// series color rather than a filled box. React escapes the label text.
export default function ChartTooltip({ active, payload, color, formatValue = formatCents }: Props) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  const label = (point.payload as { label?: string } | undefined)?.label ?? '';
  return (
    <div className="pointer-events-none rounded-xl border border-white/10 bg-[#111821]/95 px-3 py-2 shadow-lg shadow-black/40 backdrop-blur-md">
      <p className="text-sm font-bold tabular-nums text-white">{formatValue(Number(point.value ?? 0))}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[11px] text-[var(--flat-text-faint)]">{label}</span>
      </div>
    </div>
  );
}
