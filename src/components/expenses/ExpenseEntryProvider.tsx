'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import ExpenseSheet from './ExpenseSheet';

// One Add/Edit Expense sheet for the whole app. Any screen can open it —
// Events Home, a booking (event preselected), a row in a list — and every
// expense list re-fetches when `version` changes after a save/delete/undo.

type SheetRequest = { mode: 'new'; bookingId: number | null; key: number } | { mode: 'edit'; expenseId: string; key: number };

interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => Promise<void> | void;
  key: number;
}

interface ExpenseEntryContext {
  openNewExpense: (options?: { bookingId?: number | null }) => void;
  openEditExpense: (expenseId: string) => void;
  version: number;
  notifyChanged: () => void;
  showToast: (toast: Omit<ToastState, 'key'>) => void;
}

const Ctx = createContext<ExpenseEntryContext | null>(null);

export function useExpenseEntry(): ExpenseEntryContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useExpenseEntry must be used inside ExpenseEntryProvider');
  return ctx;
}

export default function ExpenseEntryProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<SheetRequest | null>(null);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const notifyChanged = useCallback(() => setVersion((v) => v + 1), []);
  const closeToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((t: Omit<ToastState, 'key'>) => setToast({ ...t, key: ++counter.current }), []);
  const openNewExpense = useCallback((options?: { bookingId?: number | null }) => {
    setRequest({ mode: 'new', bookingId: options?.bookingId ?? null, key: ++counter.current });
  }, []);
  const openEditExpense = useCallback((expenseId: string) => setRequest({ mode: 'edit', expenseId, key: ++counter.current }), []);

  return (
    <Ctx.Provider value={{ openNewExpense, openEditExpense, version, notifyChanged, showToast }}>
      {children}
      {request ? (
        <ExpenseSheet
          key={request.key}
          request={request}
          onClose={() => setRequest(null)}
          onChanged={notifyChanged}
          showToast={showToast}
        />
      ) : null}
      {toast ? <Toast key={toast.key} toast={toast} onDone={closeToast} /> : null}
    </Ctx.Provider>
  );
}

// Immediate feedback after a save, with a one-tap Undo. Sits above the
// bottom nav and disappears on its own.
function Toast({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(onDone, 6000);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[152px] z-[70] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-[440px] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111821]/95 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur-md"
      >
        <p className="min-w-0 truncate text-sm font-bold text-white">{toast.message}</p>
        {toast.actionLabel && toast.onAction ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await toast.onAction?.();
              } finally {
                onDone();
              }
            }}
            className="shrink-0 rounded-full bg-white/[0.12] px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            <span className="text-xs font-bold">{busy ? '…' : toast.actionLabel}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
