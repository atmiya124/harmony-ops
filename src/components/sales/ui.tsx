'use client';

import Link from 'next/link';
import { AlertTriangle, Download, FileText } from 'lucide-react';
import { INVOICE_STATUS_LABELS, QUOTE_STATUS_LABELS, type InvoiceStatus, type QuoteStatus } from '@/lib/sales/types';

// Building blocks for the light Quotes & Invoices screens. Colours come from
// the .tone-light tokens in globals.css; the look follows the printed Harmony
// Production quote: white panels, hairline borders, small uppercase labels
// with a short orange tick above them.

export function Card({ children, className = '', padded = true }: { children: React.ReactNode; className?: string; padded?: boolean }) {
  return <section className={`rounded-xl border border-[var(--line)] bg-[var(--paper)] ${padded ? 'p-4 md:p-5' : ''} ${className}`}>{children}</section>;
}

// "BILL TO:"-style heading: a short orange bar over a small uppercase label.
export function Eyebrow({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-2)] before:mb-1.5 before:block before:h-[3px] before:w-5 before:rounded-full before:bg-[var(--accent)]">
        {children}
      </h2>
      {aside ? <div className="text-[12px] text-[var(--ink-3)]">{aside}</div> : null}
    </div>
  );
}

export function Field({ label, error, hint, children, className = '' }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[12px] font-medium text-[var(--ink-2)]">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[12px] text-[var(--bad)]">{error}</span> : hint ? <span className="mt-1 block text-[12px] text-[var(--ink-3)]">{hint}</span> : null}
    </label>
  );
}

// 16px text stops iOS zooming the page when an input takes focus.
export const inputClass =
  'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-2 text-[16px] text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] disabled:bg-[var(--paper-sunk)] md:text-[14px] aria-[invalid=true]:border-[var(--bad)]';

// A native date input that also opens its picker on a desktop click (phones
// already open it on tap; see DateChip).
export function DateInput({ value, onChange, invalid, ...rest }: { value: string; onChange: (v: string) => void; invalid?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  return (
    <input
      {...rest}
      type="date"
      value={value}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => {
        if (!window.matchMedia('(pointer: fine)').matches) return;
        try {
          e.currentTarget.showPicker();
        } catch {
          // Already open, or unsupported.
        }
      }}
      className={`${inputClass} min-h-[42px]`}
    />
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const buttonClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--ink)] text-white hover:bg-black disabled:bg-[var(--ink-3)]',
  secondary: 'border border-[var(--line-strong)] bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--paper-sunk)]',
  ghost: 'text-[var(--ink-2)] hover:bg-[var(--paper-sunk)] hover:text-[var(--ink)]',
};

export function buttonClass(variant: ButtonVariant = 'primary', extra = '') {
  return `inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-[14px] font-semibold transition disabled:cursor-not-allowed ${buttonClasses[variant]} ${extra}`;
}

export function ButtonLink({ href, variant = 'primary', className = '', children, ...rest }: { href: string; variant?: ButtonVariant; className?: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, 'href' | 'className'>) {
  return (
    <Link href={href} className={buttonClass(variant, className)} {...rest}>
      {children}
    </Link>
  );
}

// Subtle status chips: a coloured dot on a soft tint, not a loud fill.
const QUOTE_TONES: Record<QuoteStatus, { dot: string; bg: string; text: string }> = {
  draft: { dot: 'var(--ink-3)', bg: 'var(--paper-sunk)', text: 'var(--ink-2)' },
  sent: { dot: 'var(--info)', bg: 'var(--info-soft)', text: 'var(--info)' },
  viewed: { dot: 'var(--info)', bg: 'var(--info-soft)', text: 'var(--info)' },
  accepted: { dot: 'var(--ok)', bg: 'var(--ok-soft)', text: 'var(--ok)' },
  declined: { dot: 'var(--bad)', bg: 'var(--bad-soft)', text: 'var(--bad)' },
  expired: { dot: 'var(--accent)', bg: 'var(--accent-soft)', text: 'var(--accent-ink)' },
  converted: { dot: 'var(--ok)', bg: 'var(--ok-soft)', text: 'var(--ok)' },
  cancelled: { dot: 'var(--ink-3)', bg: 'var(--paper-sunk)', text: 'var(--ink-3)' },
};

const INVOICE_TONES: Record<InvoiceStatus, { dot: string; bg: string; text: string }> = {
  draft: QUOTE_TONES.draft,
  sent: QUOTE_TONES.sent,
  viewed: QUOTE_TONES.viewed,
  partially_paid: QUOTE_TONES.expired,
  paid: QUOTE_TONES.accepted,
  void: QUOTE_TONES.cancelled,
};

function Badge({ tone, label }: { tone: { dot: string; bg: string; text: string }; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold" style={{ backgroundColor: tone.bg, color: tone.text }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: tone.dot }} />
      {label}
    </span>
  );
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return <Badge tone={QUOTE_TONES[status]} label={QUOTE_STATUS_LABELS[status]} />;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={INVOICE_TONES[status]} label={INVOICE_STATUS_LABELS[status]} />;
}

export function Notice({ tone = 'bad', children }: { tone?: 'bad' | 'info'; children: React.ReactNode }) {
  const bad = tone === 'bad';
  return (
    <div
      role={bad ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${bad ? 'border-[var(--bad)]/25 bg-[var(--bad-soft)] text-[var(--bad)]' : 'border-[var(--info)]/20 bg-[var(--info-soft)] text-[var(--info)]'}`}
    >
      {bad ? <AlertTriangle size={16} className="mt-px shrink-0" /> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function LoadError({ message }: { message: string }) {
  return (
    <Card className="py-10 text-center">
      <AlertTriangle size={22} className="mx-auto text-[var(--bad)]" />
      <p className="mt-2 text-[14px] font-semibold">Couldn&rsquo;t load this</p>
      <p className="mx-auto mt-1 max-w-xs text-[13px] text-[var(--ink-3)]">{message}</p>
    </Card>
  );
}

export { documentDate } from '@/lib/sales/format';

// Preview opens the PDF in a new tab (the browser's own viewer); Download
// saves it. `href` is the document's PDF route, e.g. /api/quotes/<id>/pdf.
export function PdfActions({ href, compact = false }: { href: string; compact?: boolean }) {
  const size = compact ? 'px-2.5 py-1.5 text-[13px]' : '';
  return (
    <>
      <a href={href} target="_blank" rel="noopener" className={buttonClass('secondary', size)}>
        <FileText size={15} /> {compact ? 'PDF' : 'Preview PDF'}
      </a>
      <a href={`${href}?download=1`} download className={buttonClass('secondary', size)} aria-label="Download PDF" title="Download PDF">
        <Download size={15} /> {compact ? null : 'Download PDF'}
      </a>
    </>
  );
}
