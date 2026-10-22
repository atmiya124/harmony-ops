'use client';

import { useState } from 'react';
import BottomSheet, { SheetButton, SheetError, SheetSection } from '@/components/ui/BottomSheet';
import { ApiError, createCrewMember, updateCrewMember, type CrewMemberDetailDto, type CrewMemberDto } from '@/lib/financeApi';
import { centsToInput, parseAmountToCents } from '@/lib/money';

// Add or edit a crew / contractor profile. Only the name is required; the
// rest is there when it's useful (how to reach them, their usual rate).
// Changing the default rate only affects labour entered from now on.

const ROLE_SUGGESTIONS = ['LED Tech', 'Audio Tech', 'Lighting Tech', 'Stagehand', 'General Crew'];

const fieldClass =
  'w-full rounded-2xl border border-[var(--flat-border)] bg-white/[0.04] px-3.5 py-3 text-base text-white outline-none placeholder:text-[var(--flat-text-faint)]';

export default function CrewFormSheet({
  member,
  onClose,
  onSaved,
}: {
  member?: CrewMemberDto; // omitted = a new profile
  onClose: () => void;
  onSaved: (saved: CrewMemberDetailDto) => void;
}) {
  const [id] = useState(() => member?.id ?? crypto.randomUUID());
  const [name, setName] = useState(member?.name ?? '');
  const [role, setRole] = useState(member?.role ?? '');
  const [rateText, setRateText] = useState(member?.defaultRateCents ? centsToInput(member.defaultRateCents) : '');
  const [phone, setPhone] = useState(member?.phone ?? '');
  const [email, setEmail] = useState(member?.email ?? '');
  const [company, setCompany] = useState(member?.company ?? '');
  const [notes, setNotes] = useState(member?.notes ?? '');
  const [active, setActive] = useState(member?.active ?? true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const set = (setter: (v: string) => void, field?: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    if (field) setFieldErrors((f) => ({ ...f, [field]: '' }));
    setFormError(null);
    setDirty(true);
  };

  async function handleSave() {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Enter a name';
    const rate = rateText.trim() ? parseAmountToCents(rateText) : null;
    if (rate && !rate.ok) errors.defaultRateCents = rate.error;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const values = {
      name: name.trim(),
      role: role.trim() || null,
      defaultRateCents: rate?.ok ? rate.cents : null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      company: company.trim() || null,
      notes: notes.trim() || null,
      active,
    };
    setSaving(true);
    try {
      onSaved(member ? await updateCrewMember(id, values, member.updatedAt) : await createCrewMember(id, values));
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(err.fieldErrors)) mapped[field] = messages[0];
        setFieldErrors(mapped);
      }
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      title={member ? 'Edit crew' : 'Add crew'}
      dirty={dirty}
      busy={saving}
      onClose={onClose}
      footer={
        <SheetButton busy={saving} disabled={!name.trim()} onClick={handleSave}>
          {saving ? 'Saving…' : member ? 'Save changes' : 'Add to crew'}
        </SheetButton>
      }
    >
      <div className="space-y-4">
        <SheetSection label="Name" error={fieldErrors.name}>
          <input value={name} onChange={set(setName, 'name')} maxLength={80} autoCapitalize="words" autoFocus={!member} placeholder="Full name" className={fieldClass} />
        </SheetSection>

        <div className="grid grid-cols-2 gap-3">
          <SheetSection label="Role" error={fieldErrors.role}>
            <input value={role} onChange={set(setRole, 'role')} maxLength={60} list="crew-roles" placeholder="e.g. LED Tech" className={fieldClass} />
            <datalist id="crew-roles">
              {ROLE_SUGGESTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </SheetSection>
          <SheetSection label="Usual rate" error={fieldErrors.defaultRateCents}>
            <label className="flex items-center gap-1 rounded-2xl border border-[var(--flat-border)] bg-white/[0.04] px-3.5 py-3">
              <span className="text-white/50">$</span>
              <input
                value={rateText}
                onChange={(e) => {
                  setRateText(e.target.value.replace(/[^\d.,]/g, ''));
                  setFieldErrors((f) => ({ ...f, defaultRateCents: '' }));
                  setDirty(true);
                }}
                inputMode="decimal"
                placeholder="0.00"
                aria-label="Usual hourly rate"
                className="w-full min-w-0 bg-transparent text-base tabular-nums text-white outline-none placeholder:text-white/25"
              />
              <span className="shrink-0 text-xs text-white/50">/h</span>
            </label>
          </SheetSection>
        </div>

        <SheetSection label="Contact (optional)" error={fieldErrors.email || fieldErrors.phone}>
          <div className="space-y-2">
            <input value={phone} onChange={set(setPhone, 'phone')} maxLength={40} type="tel" inputMode="tel" placeholder="Phone" aria-label="Phone" className={fieldClass} />
            <input value={email} onChange={set(setEmail, 'email')} type="email" inputMode="email" autoCapitalize="none" placeholder="Email" aria-label="Email" className={fieldClass} />
            <input value={company} onChange={set(setCompany, 'company')} maxLength={120} placeholder="Company / business name" aria-label="Company" className={fieldClass} />
          </div>
        </SheetSection>

        <SheetSection label="Notes (optional)">
          <textarea value={notes} onChange={set(setNotes)} rows={2} maxLength={2000} placeholder="Anything worth remembering" className={`${fieldClass} resize-none`} />
        </SheetSection>

        {member ? (
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={() => {
              setActive(!active);
              setDirty(true);
            }}
            className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/[0.03] px-3.5 py-3 text-left"
          >
            <span>
              <span className="block text-xs font-bold text-white">Active</span>
              <span className="block text-[11px] text-[var(--flat-text-faint)]">Inactive crew stay on record but aren&apos;t offered when adding labour</span>
            </span>
            <span className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition ${active ? 'bg-white' : 'bg-white/15'}`}>
              <span className={`size-5 rounded-full transition ${active ? 'translate-x-4 bg-[#0a0a0a]' : 'bg-white/70'}`} />
            </span>
          </button>
        ) : null}

        <SheetError message={formError} />
      </div>
    </BottomSheet>
  );
}
