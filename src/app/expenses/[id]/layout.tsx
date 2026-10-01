'use client';

import { use } from 'react';
import ExpenseDetailScreen from '@/components/expenses/ExpenseDetailScreen';

// The details screen lives here, not in the pages, so it stays put while
// the Edit sheet (/edit) opens and closes over it. The screen still slides
// in and out as a whole when arriving from or returning to another screen.
export default function ExpenseLayout({ params, children }: { params: Promise<{ id: string }>; children: React.ReactNode }) {
  const { id } = use(params);
  return <ExpenseDetailScreen id={id}>{children}</ExpenseDetailScreen>;
}
