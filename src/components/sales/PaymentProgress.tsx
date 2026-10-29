'use client';

import { useId } from 'react';
import { Bar, BarChart, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { CHART, useChartAnimation } from '@/components/charts/chartTheme';
import ChartDataTable from '@/components/charts/ChartDataTable';
import type { InvoiceDto } from '@/lib/quotesApi';
import { formatCents } from '@/lib/money';
import { INVOICE_PAYMENT_KIND_LABELS } from '@/lib/sales/types';
import { documentDate } from './ui';

// Light-page colours (the chart theme's are for the dark Finances cards).
const PAID = '#2d7a4c'; // --ok
const MINT = '#5fd99a'; // the PAID seal's mint
const TRACK = '#e7e5e0'; // --line
const PAPER = '#f7f7f5'; // --bg: the 2px gap between segments

const BAR_HEIGHT = 8;

interface Segment {
  key: string;
  label: string; // tooltip / table: "Deposit · 1 Oct, 2026"
  cents: number;
  owed?: boolean;
}

// The paid bar on Invoice Details: one segment per payment (oldest first),
// then the balance still owed as the track. Paid in full, the bar fills with
// a green-to-mint gradient over a faint wave that melts into the page.
export default function PaymentProgress({ invoice }: { invoice: InvoiceDto }) {
  const animate = useChartAnimation();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const paidInFull = invoice.status === 'paid';
  const paidCents = invoice.depositPaidCents + invoice.amountPaidCents;

  const segments: Segment[] = invoice.payments
    .filter((p) => !p.voidedAt)
    .sort((a, b) => a.receivedOn.localeCompare(b.receivedOn))
    .map((p) => ({ key: p.id, label: `${INVOICE_PAYMENT_KIND_LABELS[p.kind]} · ${documentDate(p.receivedOn)}`, cents: p.amountCents }));
  if (invoice.balanceDueCents > 0) segments.push({ key: 'owed', label: 'Still owed', cents: invoice.balanceDueCents, owed: true });
  if (segments.length === 0) segments.push({ key: 'owed', label: 'Still owed', cents: 1, owed: true }); // a $0 invoice: an empty track

  const row = Object.fromEntries(segments.map((s) => [s.key, s.cents]));
  const last = segments.length - 1;
  const r = BAR_HEIGHT / 2;

  return (
    <div
      className="relative w-full"
      role="progressbar"
      aria-label="Paid so far"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={invoice.totalCents > 0 ? Math.round(Math.min(1, paidCents / invoice.totalCents) * 100) : 100}
    >
      {paidInFull ? <Wave id={`${id}-wave`} /> : null}
      <BarChart responsive layout="vertical" style={{ width: '100%', height: BAR_HEIGHT + 12 }} data={[row]} margin={{ top: 6, right: 0, bottom: 6, left: 0 }} barCategoryGap={0}>
        <defs>
          {/* Across the whole bar, not restarted in each segment. */}
          <linearGradient id={`${id}-fill`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100%" y2="0">
            <stop offset="0%" stopColor={PAID} />
            <stop offset="100%" stopColor={MINT} />
          </linearGradient>
        </defs>
        <XAxis type="number" hide domain={[0, 'dataMax']} />
        <YAxis type="category" hide />
        <Tooltip content={<SegmentTooltip segments={segments} />} shared={false} cursor={false} isAnimationActive={false} />
        {segments.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="paid"
            barSize={BAR_HEIGHT}
            fill={s.owed ? TRACK : paidInFull ? `url(#${id}-fill)` : PAID}
            stroke={PAPER}
            strokeWidth={segments.length > 1 ? 2 : 0}
            radius={[i === 0 ? r : 0, i === last ? r : 0, i === last ? r : 0, i === 0 ? r : 0]}
            isAnimationActive={animate && !s.owed}
            animationDuration={CHART.animationMs}
            animationEasing={CHART.animationEasing}
          />
        ))}
      </BarChart>
      <ChartDataTable caption="Payments toward the total" data={segments.map((s) => ({ label: s.label, value: s.cents }))} />
    </div>
  );
}

// A soft mint wave behind the bar, cresting above it and fading to nothing
// at its ends and below.
function Wave({ id }: { id: string }) {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -top-5 h-[52px] w-full"
      viewBox="0 0 400 52"
      preserveAspectRatio="none"
      style={{ maskImage: 'linear-gradient(to right, transparent, #000 15%, #000 85%, transparent)' }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={MINT} stopOpacity={0.28} />
          <stop offset="100%" stopColor={MINT} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d="M0 20 C 50 6, 100 6, 150 16 S 250 30, 300 16 S 375 6, 400 12 L 400 52 L 0 52 Z" fill={`url(#${id})`} />
    </svg>
  );
}

function SegmentTooltip({ active, payload, segments }: Partial<TooltipContentProps<number, string>> & { segments: Segment[] }) {
  // Not shared: the payload is just the segment under the pointer.
  const key = active ? payload?.[0]?.dataKey : undefined;
  const s = segments.find((seg) => seg.key === key);
  if (!s) return null;
  return (
    <div className="pointer-events-none rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
      <p className="font-semibold tabular-nums text-[var(--ink)]">{formatCents(s.cents)}</p>
      <p className="text-[var(--ink-3)]">{s.label}</p>
    </div>
  );
}
