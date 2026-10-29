'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { PAID_STAMP_SRC } from '@/lib/documents/paidStamp';
import { AlertTriangle, Download, FileText } from 'lucide-react';
import { INVOICE_PAYMENT_METHOD_LABELS, INVOICE_PAYMENT_METHODS, INVOICE_STATUS_LABELS, QUOTE_STATUS_LABELS, type InvoicePaymentMethod, type InvoiceStatus, type QuoteStatus } from '@/lib/sales/types';

// Building blocks for the light Quotes & Invoices screens. Colours come from
// the .tone-light tokens in globals.css; the look follows the printed Harmony
// Production quote: white panels, hairline borders, small uppercase labels
// with a short orange tick above them.

// A white card; `tray` is the soft grey panel for secondary blocks (the
// client link) and the side panel that white cards sit in.
export function Card({ children, className = '', padded = true, tone = 'paper' }: { children: React.ReactNode; className?: string; padded?: boolean; tone?: 'paper' | 'tray' }) {
  const look = tone === 'tray' ? 'bg-[var(--tray)]' : 'border border-[var(--line)] bg-[var(--paper)] shadow-[0_1px_2px_rgba(0,0,0,0.03)]';
  return <section className={`rounded-2xl ${look} ${padded ? 'p-4 md:p-5' : ''} ${className}`}>{children}</section>;
}

// The colour a quote status reads in (as in its badge), for status text.
export function quoteStatusColor(status: QuoteStatus): string {
  return QUOTE_TONES[status].text;
}

export function invoiceStatusColor(status: InvoiceStatus): string {
  return INVOICE_TONES[status].text;
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

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

// Harmony Ops buttons, in the light Sales colours: bold pills that press in
// slightly; the primary is the solid high-contrast fill (white on the dark
// app, ink here), the secondary an outline.
const buttonClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--ink)] text-white hover:bg-black',
  secondary: 'border border-[var(--line-strong)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--ink-3)] hover:bg-[var(--paper-sunk)]',
  ghost: 'text-[var(--ink-2)] hover:bg-[var(--paper-sunk)] hover:text-[var(--ink)]',
  danger: 'bg-[var(--bad)] text-white hover:brightness-95',
};

// Default sizes, each dropped when `extra` brings its own (Tailwind decides
// between two padding classes by stylesheet order, not by which comes last).
const BUTTON_SIZE: [RegExp, string][] = [
  [/(^|\s)px-/, 'px-5'],
  [/(^|\s)py-/, 'py-2.5'],
  [/(^|\s)text-\[\d/, 'text-[14px]'],
];

export function buttonClass(variant: ButtonVariant = 'primary', extra = '') {
  const size = BUTTON_SIZE.filter(([own]) => !own.test(extra)).map(([, cls]) => cls).join(' ');
  return `inline-flex touch-manipulation select-none items-center justify-center gap-1.5 rounded-full ${size} font-bold transition-[transform,background-color,border-color,color] duration-75 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] ${buttonClasses[variant]} ${extra}`;
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
// `compact` (list rows): two small round icon buttons.
export function PdfActions({ href, compact = false }: { href: string; compact?: boolean }) {
  if (compact) {
    return (
      <>
        <a href={href} target="_blank" rel="noopener" className={iconButtonClass('size-8')} aria-label="Preview PDF" title="Preview PDF">
          <FileText size={15} />
        </a>
        <a href={`${href}?download=1`} download className={iconButtonClass('size-8')} aria-label="Download PDF" title="Download PDF">
          <Download size={15} />
        </a>
      </>
    );
  }
  return (
    <>
      <a href={href} target="_blank" rel="noopener" className={buttonClass('secondary')}>
        <FileText size={15} /> Preview PDF
      </a>
      <a href={`${href}?download=1`} download className={buttonClass('secondary')} aria-label="Download PDF" title="Download PDF">
        <Download size={15} /> Download PDF
      </a>
    </>
  );
}

// ---------------------------------------------------------------- lists

// A round white icon button with a soft shadow, as in the list headers.
// `size` replaces the default 40px.
export function iconButtonClass(size = 'size-10') {
  return `inline-flex ${size} shrink-0 touch-manipulation items-center justify-center rounded-full bg-[var(--paper)] text-[var(--ink)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.05] transition-[transform,background-color] duration-75 hover:bg-[var(--paper-sunk)] active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]`;
}

export function IconLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} aria-label={label} title={label} className={iconButtonClass()}>
      {children}
    </Link>
  );
}

// The screen's main action on phones, floating bottom-right just above the
// tab bar (like a native app), whatever the scroll position. Desktop keeps
// the header icon instead. The spacer stops the list's last row ending up
// underneath it.
export function FloatingActionLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-16 md:hidden" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[100px] z-40 flex justify-end px-4 md:hidden">
        {/* Icon only; the label is for screen readers and the tooltip. */}
        <Link
          href={href}
          aria-label={label}
          title={label}
          className="pointer-events-auto inline-flex size-14 touch-manipulation select-none items-center justify-center rounded-full bg-[var(--ink)] text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-transform duration-75 active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
        >
          {children}
        </Link>
      </div>
    </>
  );
}

// The white card a list sits in, its column headings and row dividers. Rows
// run edge to edge (the outer cells carry the card's side padding), so a
// clickable row's hover highlight fills the full width and is clipped
// cleanly by the card's rounded corners.
export const listCardClass = 'overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--paper)] shadow-[0_1px_2px_rgba(0,0,0,0.03)]';
export const listHeadClass = 'px-3 py-3 text-[13px] font-medium text-[var(--ink-3)] first:pl-5 last:pr-5';
export const listCellClass = 'px-3 py-3.5 first:pl-5 last:pr-5';
export const listRowClass = 'border-b border-[var(--line)] last:border-0';
export const listRowHoverClass = 'cursor-pointer transition-colors hover:bg-[#f0f0f2]';

const AVATAR_COLOURS = ['#1f1f22', '#c2410c', '#2563eb', '#7c3aed', '#0f766e', '#be123c', '#b45309', '#475569'];

// A coloured circle with the customer's initials; the same name always gets
// the same colour.
export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), backgroundColor: AVATAR_COLOURS[hash % AVATAR_COLOURS.length] }}
    >
      {initials}
    </span>
  );
}

// Who created a record, as their initials in a small outlined circle — kept
// quieter than the customer's coloured Avatar so the two aren't confused.
// The full name is in the tooltip and read out to screen readers.
export function CreatorInitials({ name, initials, size = 28 }: { name: string; initials: string; size?: number }) {
  return (
    <span
      title={`Created by ${name}`}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--paper)] font-bold text-[var(--ink-2)]"
      // Grows into a pill for three letters ("AtP"), still one line high.
      style={{ minWidth: size, height: size, paddingInline: initials.length > 2 ? Math.round(size * 0.22) : 0, fontSize: Math.max(9, Math.round(size * 0.38)) }}
    >
      <span aria-hidden>{initials}</span>
      <span className="sr-only">Created by {name}</span>
    </span>
  );
}

// A quiet grey tag, e.g. a quote number.
export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center whitespace-nowrap rounded-md bg-[var(--paper-sunk)] px-2 py-1 text-[12px] font-medium tabular-nums text-[var(--ink-2)]">{children}</span>;
}

// ---------------------------------------------------------------- dialog

// A centred window on a dimmed page (the native <dialog>: Esc closes it and
// focus stays inside). Clicking the dimmed area closes it unless `locked`.
export function Dialog({ open, onClose, locked = false, labelledBy, children }: { open: boolean; onClose: () => void; locked?: boolean; labelledBy: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onCancel={(e) => {
        if (locked) e.preventDefault();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !locked) onClose();
      }}
      className="m-auto w-[calc(100%-24px)] max-w-lg bg-transparent p-0 text-[var(--ink)] backdrop:bg-black/40"
    >
      <div className="max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[28px] bg-[var(--tray)] p-2">{children}</div>
    </dialog>
  );
}

// How a payment was made: a native select (phones show their own picker).
export function PaymentMethodSelect({ value, onChange, id }: { value: InvoicePaymentMethod; onChange: (m: InvoicePaymentMethod) => void; id?: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value as InvoicePaymentMethod)} className={`${inputClass} min-h-[42px]`}>
      {INVOICE_PAYMENT_METHODS.map((m) => (
        <option key={m} value={m}>
          {INVOICE_PAYMENT_METHOD_LABELS[m]}
        </option>
      ))}
    </select>
  );
}

// The PAID seal, as on the invoice PDF (public/icons/paid.svg).
export function PaidStamp({ size = 64 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small fixed-size icon served from /public
  return <img src={PAID_STAMP_SRC} width={size} height={size} alt="Paid" className="shrink-0" />;
}
