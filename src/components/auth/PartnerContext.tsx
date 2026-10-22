'use client';

import { createContext, useContext } from 'react';
import type { Partner } from '@/lib/auth/session';

// Who's signed in, for client components deep in a page (e.g. the Sales
// menu opened from a screen's header). Provided once by the root layout.
const PartnerContext = createContext<Partner | null>(null);

export function PartnerProvider({ partner, children }: { partner: Partner; children: React.ReactNode }) {
  return <PartnerContext.Provider value={partner}>{children}</PartnerContext.Provider>;
}

export function usePartner(): Partner | null {
  return useContext(PartnerContext);
}
