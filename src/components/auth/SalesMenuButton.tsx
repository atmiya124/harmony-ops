'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import SalesMenu from './SalesMenu';
import { Avatar } from './ProfileMenu';
import { usePartner } from './PartnerContext';
import { signOutToLogin } from './signOut';
import { salesPageFor } from '../navTypes';

// The ☰ button beside the title on Sales screens: opens the Sales menu
// (Quotes, Invoices, Inventory, Customers) from the left.
export default function SalesMenuButton() {
  const partner = usePartner();
  const active = salesPageFor(usePathname());
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (!partner) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Sales menu"
        aria-expanded={open}
        className="-ml-1.5 mr-2 flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--paper)] text-[var(--ink)] shadow-[0_1px_3px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.05] transition active:scale-95"
      >
        <Menu size={20} strokeWidth={2.25} />
      </button>
      {open ? (
        <SalesMenu
          partner={partner}
          active={active}
          avatar={<Avatar partner={partner} />}
          signingOut={signingOut}
          onSignOut={async () => {
            setSigningOut(true);
            await signOutToLogin();
          }}
          onClose={close}
        />
      ) : null}
    </>
  );
}
