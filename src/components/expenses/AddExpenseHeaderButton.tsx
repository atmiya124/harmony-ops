'use client';

import { Plus } from 'lucide-react';
import { useExpenseEntry } from './ExpenseEntryProvider';

// Round white "+" for a screen header (same style as Bookings' new-booking
// button); opens the Add Expense sheet.
export default function AddExpenseHeaderButton() {
  const { openNewExpense } = useExpenseEntry();
  return (
    <button
      type="button"
      onClick={() => openNewExpense()}
      aria-label="Add expense"
      className="flex size-11 items-center justify-center rounded-full bg-white text-[#0a0a0a] shadow-lg shadow-black/40"
    >
      <Plus size={22} strokeWidth={2.5} />
    </button>
  );
}
