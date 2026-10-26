'use client';

import { use, useState } from 'react';
import { Pencil } from 'lucide-react';
import Screen from '@/components/navigation/Screen';
import CrewProfile from '@/components/crew/CrewProfile';
import CrewFormSheet from '@/components/crew/CrewFormSheet';
import { useExpenseEntry } from '@/components/expenses/ExpenseEntryProvider';
import { useCachedData } from '@/hooks/useCachedData';
import { crewMemberKey, getCrewMember } from '@/lib/financeApi';

// One crew person's profile, with Edit in the header.
export default function CrewMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { version, notifyChanged, showToast } = useExpenseEntry();
  const { data: member, error } = useCachedData(crewMemberKey(id), () => getCrewMember(id), version);
  const [editing, setEditing] = useState(false);

  const editAction = member ? (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label="Edit profile"
      className="flex size-11 items-center justify-center rounded-full bg-white text-[#0a0a0a] transition-transform duration-75 active:scale-[0.95]"
    >
      <Pencil size={18} strokeWidth={2.25} />
    </button>
  ) : null;

  return (
    <Screen title={member?.name ?? 'Crew'} compactTitle back action={editAction}>
      <CrewProfile member={member} error={error} />
      {editing && member ? (
        <CrewFormSheet
          member={member}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            notifyChanged();
            showToast({ message: 'Profile saved' });
          }}
        />
      ) : null}
    </Screen>
  );
}
