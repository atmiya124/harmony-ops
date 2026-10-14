'use client';

import { use } from 'react';
import Screen from '@/components/navigation/Screen';
import PartnerDetail from '@/components/finances/PartnerDetail';
import { partnerLabel } from '@/components/expenses/partnerLabel';
import { safeBackPath } from '@/components/navigation/navDirection';
import { useCachedData } from '@/hooks/useCachedData';
import { getPartnerSummary, partnerKey } from '@/lib/financeApi';

// `?from=` (e.g. /finances/owed) is where Back goes when the page was opened
// from somewhere other than Finances itself.
export default function PartnerPage({ params, searchParams }: { params: Promise<{ email: string }>; searchParams: Promise<{ from?: string }> }) {
  const email = decodeURIComponent(use(params).email).toLowerCase();
  const back = safeBackPath(use(searchParams).from) ?? true;
  const { data } = useCachedData(partnerKey(email), () => getPartnerSummary(email));
  return (
    <Screen title={data ? partnerLabel(data.partner) : 'Partner'} back={back}>
      <PartnerDetail email={email} />
    </Screen>
  );
}
