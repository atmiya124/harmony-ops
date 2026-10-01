'use client';

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import ExpenseDetails from './ExpenseDetails';
import { useExpenseEntry } from './ExpenseEntryProvider';
import Screen from '@/components/navigation/Screen';
import ErrorState from '@/components/ui/ErrorState';
import { useCachedData } from '@/hooks/useCachedData';
import { expenseKey, FINANCE_PARTNERS_KEY, getExpense, getPartners } from '@/lib/financeApi';

// /expenses/[id] and /expenses/[id]/edit share this screen (it's rendered by
// their layout, so it stays mounted between them): the read-only details,
// with the Edit sheet opening over them at /edit. Being in the layout also
// means switching to and from /edit never plays a screen push or pop.

const CloseEditContext = createContext<(() => void) | null>(null);

// Leaves /edit for the details: Back when the sheet was opened from them
// (so the history has no extra entry), otherwise — e.g. a deep link to
// /edit — a replace.
export function useCloseExpenseEdit(): () => void {
  const close = useContext(CloseEditContext);
  if (!close) throw new Error('useCloseExpenseEdit must be used inside ExpenseDetailScreen');
  return close;
}

export default function ExpenseDetailScreen({ id, children }: { id: string; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { version } = useExpenseEntry();
  const detailsPath = `/expenses/${id}`;

  // Refetched after every save, delete or undo anywhere in the app.
  const expenseData = useCachedData(expenseKey(id), () => getExpense(id), version);
  const partners = useCachedData(FINANCE_PARTNERS_KEY, getPartners).data?.partners ?? [];
  const expense = expenseData.data;

  const previousPath = useRef<string | null>(null);
  const editOpenedFromDetails = useRef(false);
  useEffect(() => {
    if (pathname !== detailsPath) editOpenedFromDetails.current = previousPath.current === detailsPath;
    previousPath.current = pathname;
  }, [pathname, detailsPath]);

  const closeEdit = useCallback(() => {
    if (editOpenedFromDetails.current) router.back();
    else router.replace(detailsPath);
  }, [router, detailsPath]);

  const editAction =
    expense && !expense.deletedAt ? (
      <Link
        href={`${detailsPath}/edit`}
        aria-label="Edit expense"
        className="flex size-11 items-center justify-center rounded-full border border-[rgba(251,146,60,0.35)] bg-[rgba(251,146,60,0.14)] text-[var(--neon-orange)]"
      >
        <Pencil size={18} strokeWidth={2.25} />
      </Link>
    ) : null;

  return (
    <Screen title="Expense Details" compactTitle back action={editAction}>
      {expense ? (
        <ExpenseDetails expense={expense} partners={partners} />
      ) : expenseData.error ? (
        <ErrorState message={expenseData.error} />
      ) : (
        <p className="py-20 text-center text-sm text-white/25">Loading…</p>
      )}
      <CloseEditContext.Provider value={closeEdit}>{children}</CloseEditContext.Provider>
    </Screen>
  );
}
