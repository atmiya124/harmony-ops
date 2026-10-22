import Link from 'next/link';
import { ChevronRight, Paperclip } from 'lucide-react';
import { CATEGORY_META } from './categoryMeta';
import { colorAlpha } from '@/lib/colorAlpha';
import type { ExpenseDto } from '@/lib/financeApi';
import { formatCents } from '@/lib/money';
import { labourSummaryLabel } from '@/lib/finance/labour';

// One expense as a tappable row (icon · category · details · amount) that
// opens its details. The caller says what the details line and amount are,
// so lists can show what matters to them (the event, what's still owed…).
// Crew labour stays a summary here — people, hours, what's unpaid — never
// names or rates; those are on its details screen.
export default function ExpenseRow({ expense, details, amount, amountNote }: { expense: ExpenseDto; details: string; amount: string; amountNote?: string }) {
  const meta = CATEGORY_META[expense.category];
  const Icon = meta.icon;
  const labour = expense.labour;
  const title = expense.kind === 'labour' ? 'Crew labour' : expense.kind === 'labour_payment' ? 'Crew payment' : meta.label;
  const note = amountNote ?? (labour && labour.remainingCents > 0 ? `${formatCents(labour.remainingCents)} unpaid` : undefined);
  return (
    <li>
      <Link href={`/expenses/${expense.id}`} className="flex w-full items-center gap-3 py-3 text-left">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: colorAlpha(meta.color, 16) }}>
          <Icon size={19} style={{ color: meta.color }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[15px] font-bold text-white">{title}</span>
            {expense.receipt ? <Paperclip size={12} className="shrink-0 text-white/35" aria-label="Has receipt" /> : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-[var(--flat-text-faint)]">{labour ? `${details} · ${labourSummaryLabel(labour)}` : details}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[15px] font-bold tabular-nums text-white">{amount}</span>
          {note ? <span className={`block text-[11px] tabular-nums ${amountNote ? 'text-[var(--flat-text-faint)]' : 'text-[var(--neon-orange)]'}`}>{note}</span> : null}
        </span>
        <ChevronRight size={16} className="shrink-0 text-white/30" />
      </Link>
    </li>
  );
}
