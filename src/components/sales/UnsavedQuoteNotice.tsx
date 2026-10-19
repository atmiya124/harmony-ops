'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readStoredDraft } from '@/lib/sales/quoteDraftStore';
import { Notice } from './ui';

// A new quote left unsaved on this device (the page was closed or the
// partner tapped Back) — one tap back into it.
export default function UnsavedQuoteNotice() {
  const [customer, setCustomer] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredDraft({ mode: 'create' });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage is only readable after mount
    if (stored) setCustomer(stored.draft.customerName.trim());
  }, []);

  if (customer === null) return null;
  return (
    <div className="mb-3">
      <Notice tone="info">
        <p>
          You have an unsaved quote{customer ? ` for ${customer}` : ''}.{' '}
          <Link href="/quotes/new" className="font-semibold underline">
            Continue it
          </Link>
        </p>
      </Notice>
    </div>
  );
}
