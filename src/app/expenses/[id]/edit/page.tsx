'use client';

import { use } from 'react';
import ExpenseSheet from '@/components/expenses/ExpenseSheet';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import { useCloseExpenseEdit } from '@/components/expenses/ExpenseDetailScreen';

// The Edit Expense sheet, over the expense's details (see the layout).
// Saving, deleting or closing it returns to the details.
export default function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { notifyChanged, showToast } = useExpenseEntry();
  const closeEdit = useCloseExpenseEdit();
  return <ExpenseSheet request={{ mode: 'edit', expenseId: id }} onClose={closeEdit} onChanged={notifyChanged} showToast={showToast} />;
}
