'use client';

import Link from 'next/link';
import { ArrowUpRight, ChevronRight, FileText, NotebookText, Paperclip } from 'lucide-react';
import { CATEGORY_META } from './categoryMeta';
import { partnerLabel } from './partnerLabel';
import { colorAlpha } from '@/lib/colorAlpha';
import { receiptUrl, type ExpenseDetailDto, type PartnerOption } from '@/lib/financeApi';
import { formatCents } from '@/lib/money';
import { PAYMENT_METHOD_LABELS, REIMBURSEMENT_STATUS_LABELS, type ReimbursementStatus } from '@/lib/finance/types';

// The read-only Expense Details screen: what was spent, where, by whom, and
// the receipt. Editing happens only from the header pencil (Edit sheet).

// "Sep 25, 2026" for a YYYY-MM-DD date, read as a local calendar date.
function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// "Sep 25, 2026 · 12:03 PM" for an ISO timestamp, in the viewer's timezone.
function timestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Paid back in full reads as done; anything still owed reads as waiting.
const STATUS_COLOR: Record<Exclude<ReimbursementStatus, 'not_required'>, string> = {
  reimbursed: 'var(--neon-green)',
  partial: 'var(--neon-orange)',
  pending: 'var(--neon-orange)',
};

export default function ExpenseDetails({ expense, partners }: { expense: ExpenseDetailDto; partners: PartnerOption[] }) {
  const meta = CATEGORY_META[expense.category];
  const Icon = meta.icon;
  const paidBy = partnerLabel(partners.find((p) => p.email === expense.paidByEmail) ?? { email: expense.paidByEmail, name: null });
  const { status, outstandingCents } = expense.reimbursement;

  return (
    <div className="space-y-4 pb-2">
      {expense.deletedAt ? (
        <p className="rounded-2xl border border-[rgba(244,114,182,0.3)] bg-[rgba(244,114,182,0.08)] px-4 py-3 text-sm text-[var(--neon-pink)]">
          This expense was deleted.
        </p>
      ) : null}

      {/* Hero: what it was, and how much. */}
      <section className="flex items-center gap-4 px-1 pb-2 pt-1">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colorAlpha(meta.color, 18) }}>
          <Icon size={28} style={{ color: meta.color }} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[22px] font-semibold leading-tight text-white">{meta.label}</h2>
          <p className="mt-1 text-[34px] font-bold leading-none tracking-tight tabular-nums text-white">{formatCents(expense.amountCents)}</p>
        </div>
      </section>

      <Card>
        <h3 className="mb-4 text-[17px] font-semibold text-white">Details</h3>
        <dl className="space-y-4">
          <Row label="Account">{expense.fundingSource === 'company' ? 'Company' : 'Personal'}</Row>
          {status !== 'not_required' ? (
            <Row label="Reimbursement">
              <span className="flex flex-col items-end gap-1">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium"
                  style={{ backgroundColor: colorAlpha(STATUS_COLOR[status], 14), color: STATUS_COLOR[status] }}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
                  {REIMBURSEMENT_STATUS_LABELS[status]}
                </span>
                {status === 'partial' ? <span className="text-[13px] text-white/45">{formatCents(outstandingCents)} still owed</span> : null}
              </span>
            </Row>
          ) : null}
          <Row label="Date">{longDate(expense.expenseDate)}</Row>
        </dl>

        <div className="my-5 border-t border-white/[0.07]" />

        <dl className="space-y-4">
          <Row label="Event">
            {expense.booking ? (
              <Link href={`/events/bookings/${expense.booking.id}`} className="inline-flex max-w-full items-center gap-1 text-white">
                <span className="truncate">{expense.booking.title}</span>
                <ChevronRight size={16} className="shrink-0 text-white/35" />
              </Link>
            ) : expense.bookingDeleted ? (
              <span className="text-white/45">Deleted event</span>
            ) : (
              'General business'
            )}
          </Row>
          <Row label="Paid by">{paidBy}</Row>
          <Row label="Paid with">{PAYMENT_METHOD_LABELS[expense.paymentMethod]}</Row>
          {/* The amount already includes HST, so the breakdown only earns its
              place when there's HST to break out. */}
          {expense.taxCents > 0 ? (
            <>
              <Row label="HST included">{formatCents(expense.taxCents)}</Row>
              <div className="flex items-baseline justify-between gap-4 border-t border-white/[0.07] pt-4">
                <dt className="text-[15px] text-white/45">Total amount</dt>
                <dd className="text-[18px] font-bold tabular-nums text-white">{formatCents(expense.amountCents)}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </Card>

      <ReceiptCard receipt={expense.receipt} />

      {expense.notes ? (
        <Card>
          <div className="flex items-start gap-3.5">
            <NotebookText size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-white/70" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[17px] font-semibold text-white">Notes</h3>
              <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-relaxed text-white/70">{expense.notes}</p>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function ReceiptCard({ receipt }: { receipt: ExpenseDetailDto['receipt'] }) {
  if (!receipt) {
    return (
      <Card>
        <div className="flex items-center gap-3.5">
          <Paperclip size={20} strokeWidth={1.75} className="shrink-0 text-white/35" />
          <div>
            <h3 className="text-[17px] font-semibold text-white">Receipt</h3>
            <p className="mt-0.5 text-[14px] text-white/40">No receipt attached</p>
          </div>
        </div>
      </Card>
    );
  }

  const isImage = receipt.contentType.startsWith('image/');
  const href = receiptUrl(receipt.id);
  return (
    <Card>
      <h3 className="mb-4 flex items-center gap-3.5 text-[17px] font-semibold text-white">
        <Paperclip size={20} strokeWidth={1.75} className="shrink-0 text-white/70" />
        Receipt (1)
      </h3>
      {/* Opens the stored file in the browser's own viewer. */}
      <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.05]">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- private, session-checked API file, not an optimisable asset
            <img src={href} alt="Receipt preview" className="size-full object-cover" />
          ) : (
            <FileText size={26} strokeWidth={1.5} className="text-white/60" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-white">{receipt.filename ?? (isImage ? 'Receipt photo' : 'Receipt PDF')}</span>
          <span className="mt-0.5 block truncate text-[13px] text-white/45">
            {fileSize(receipt.sizeBytes)} · {timestamp(receipt.uploadedAt)}
          </span>
          <span className="mt-1.5 inline-flex items-center gap-1 text-[14px] font-semibold text-[var(--neon-orange)]">
            View
            <ArrowUpRight size={15} />
          </span>
        </span>
      </a>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-[24px] border border-white/[0.08] bg-[#0a0f16]/80 p-5">{children}</section>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-[15px] text-white/45">{label}</dt>
      <dd className="min-w-0 text-right text-[15px] text-white">{children}</dd>
    </div>
  );
}
