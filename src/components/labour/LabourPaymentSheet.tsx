'use client';

import { useEffect, useState } from 'react';
import { Banknote, Building2, CreditCard, Send } from 'lucide-react';
import BottomSheet, { SheetButton, SheetError, SheetSection } from '@/components/ui/BottomSheet';
import DateChip from '@/components/ui/DateChip';
import { partnerLabel } from '@/components/expenses/partnerLabel';
import { ApiError, FINANCE_PARTNERS_KEY, getPartners, recordLabourPayment, type EventLabourDto, type LabourLineDto, type PartnerOption } from '@/lib/financeApi';
import { loadCached, peekCache } from '@/lib/clientCache';
import { centsToInput, formatCents, parseAmountToCents } from '@/lib/money';
import { friendlyDate, todayLocal } from '@/lib/finance/dates';
import { defaultFundingSource } from '@/lib/finance/reimbursement';
import { PAYMENT_METHOD_LABELS, type FundingSource, type PaymentMethod } from '@/lib/finance/types';

// Recording money paid to one crew person, after their hours are in. Uses
// the same "paid by / paid with / whose money" as an expense, so a partner
// who paid from their own pocket shows up in Owed to partners.

const PAYMENT_ICONS: Record<PaymentMethod, typeof CreditCard> = {
  personal_card: CreditCard,
  company_card: Building2,
  cash: Banknote,
  etransfer: Send,
};
const PAYMENT_ORDER: PaymentMethod[] = ['etransfer', 'cash', 'company_card', 'personal_card'];

export default function LabourPaymentSheet({
  line,
  onClose,
  onSaved,
}: {
  line: LabourLineDto;
  onClose: () => void;
  onSaved: (labour: EventLabourDto, amountCents: number) => void;
}) {
  const today = todayLocal();
  const [paymentId] = useState(() => crypto.randomUUID()); // a retried save can't pay twice
  const [amountText, setAmountText] = useState(centsToInput(line.remainingCents));
  const [paidOn, setPaidOn] = useState(today);
  const [partners, setPartners] = useState<PartnerOption[]>(() => peekCache<{ partners: PartnerOption[] }>(FINANCE_PARTNERS_KEY)?.partners ?? []);
  const [paidByEmail, setPaidByEmail] = useState(() => peekCache<{ me: string }>(FINANCE_PARTNERS_KEY)?.me ?? '');
  const [method, setMethod] = useState<PaymentMethod>('etransfer');
  const [cashLikeFunding, setCashLikeFunding] = useState<FundingSource>('company');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    loadCached(FINANCE_PARTNERS_KEY, getPartners)
      .then(({ me, partners }) => {
        setPartners(partners);
        setPaidByEmail((current) => current || me);
      })
      .catch((err) => setFormError(err instanceof Error ? err.message : 'Could not load partners'));
  }, []);

  const amount = parseAmountToCents(amountText);
  const fundingSource: FundingSource = method === 'cash' || method === 'etransfer' ? cashLikeFunding : defaultFundingSource(method);
  const touch = () => {
    setDirty(true);
    setFormError(null);
  };

  async function handleSave() {
    const errors: Record<string, string> = {};
    if (!amount.ok) errors.amountCents = amount.error;
    else if (amount.cents > line.remainingCents) errors.amountCents = `Only ${formatCents(line.remainingCents)} is owed`;
    if (!paidByEmail) errors.paidByEmail = 'Choose who paid';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !amount.ok) return;
    setSaving(true);
    try {
      const labour = await recordLabourPayment(line.id, paymentId, {
        amountCents: amount.cents,
        paidOn,
        paidByEmail,
        paymentMethod: method,
        fundingSource,
        reimbursable: fundingSource === 'personal',
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      onSaved(labour, amount.cents);
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(err.fieldErrors)) mapped[field === 'paidOn' ? 'paidOn' : field] = messages[0];
        setFieldErrors(mapped);
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  const payer = partners.find((p) => p.email === paidByEmail);
  return (
    <BottomSheet
      title="Record payment"
      subtitle={`${line.workerName} · ${formatCents(line.remainingCents)} owed`}
      dirty={dirty}
      busy={saving}
      onClose={onClose}
      footer={
        <SheetButton busy={saving} disabled={!amount.ok || !paidByEmail} onClick={handleSave}>
          {saving ? 'Saving…' : amount.ok ? `Record ${formatCents(amount.cents)}` : 'Record payment'}
        </SheetButton>
      }
    >
      <div className="space-y-5">
        <SheetSection label="Amount" error={fieldErrors.amountCents}>
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-1.5 rounded-2xl border border-[var(--flat-border)] bg-white/[0.04] px-3.5 py-3">
              <span className="text-white/50">$</span>
              <input
                value={amountText}
                onChange={(e) => {
                  setAmountText(e.target.value.replace(/[^\d.,]/g, ''));
                  setFieldErrors((f) => ({ ...f, amountCents: '' }));
                  touch();
                }}
                inputMode="decimal"
                aria-label="Amount paid"
                className="w-full bg-transparent text-base font-bold tabular-nums text-white outline-none"
              />
            </label>
            <DateChip
              value={paidOn}
              label={friendlyDate(paidOn, today)}
              min="2025-01-01"
              max={today}
              onChange={(v) => {
                setPaidOn(v);
                touch();
              }}
              ariaLabel="Date paid"
              className="rounded-2xl border border-[var(--flat-border)] bg-white/[0.03] px-3 py-3"
            />
          </div>
          {fieldErrors.paidOn ? <p className="mt-1.5 text-xs text-[var(--neon-pink)]">{fieldErrors.paidOn}</p> : null}
        </SheetSection>

        <SheetSection label="Paid with">
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_ORDER.map((m) => {
              const Icon = PAYMENT_ICONS[m];
              const selected = method === m;
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setMethod(m);
                    touch();
                  }}
                  className={`flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
                    selected ? 'border-white/40 bg-white/[0.1] text-white' : 'border-[var(--flat-border)] text-[var(--flat-text-dim)]'
                  }`}
                >
                  <Icon size={16} className={selected ? 'text-white' : 'text-white/45'} />
                  <span className="text-xs font-bold">{PAYMENT_METHOD_LABELS[m]}</span>
                </button>
              );
            })}
          </div>
          {method === 'cash' || method === 'etransfer' ? (
            <div className="mt-2 flex items-center justify-between rounded-2xl bg-white/[0.03] px-3 py-2">
              <span className="text-xs text-[var(--flat-text-faint)]">Whose money?</span>
              <div className="flex gap-1 rounded-full bg-white/[0.05] p-0.5">
                {(['company', 'personal'] as FundingSource[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={cashLikeFunding === s}
                    onClick={() => {
                      setCashLikeFunding(s);
                      touch();
                    }}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${cashLikeFunding === s ? 'bg-white text-[#0a0a0a]' : 'text-[var(--flat-text-dim)]'}`}
                  >
                    <span className="text-[11px] font-bold">{s === 'personal' ? 'Personal' : 'Company'}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </SheetSection>

        <SheetSection label="Paid by" error={fieldErrors.paidByEmail}>
          <div className="flex flex-wrap gap-2">
            {partners.map((p) => {
              const selected = paidByEmail === p.email;
              return (
                <button
                  key={p.email}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setPaidByEmail(p.email);
                    touch();
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    selected ? 'border-white/40 bg-white/[0.1] text-white' : 'border-[var(--flat-border)] text-[var(--flat-text-dim)]'
                  }`}
                >
                  <span className="text-xs font-bold">{partnerLabel(p)}</span>
                </button>
              );
            })}
            {partners.length === 0 ? <p className="text-xs text-[var(--flat-text-ghost)]">Loading partners…</p> : null}
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--flat-text-faint)]">
            {fundingSource === 'company' ? 'Company money — nothing owed back.' : `${payer ? partnerLabel(payer) : 'They'} will be owed this back.`}
          </p>
        </SheetSection>

        <SheetSection label="Reference & note (optional)">
          <div className="space-y-2">
            <input
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                touch();
              }}
              maxLength={100}
              placeholder="e.g. e-transfer or cheque number"
              aria-label="Reference"
              className="w-full rounded-2xl border border-[var(--flat-border)] bg-white/[0.04] px-3.5 py-3 text-base text-white outline-none placeholder:text-[var(--flat-text-faint)]"
            />
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                touch();
              }}
              rows={2}
              maxLength={500}
              placeholder="Note"
              aria-label="Note"
              className="w-full resize-none rounded-2xl border border-[var(--flat-border)] bg-white/[0.04] p-3 text-base text-white outline-none placeholder:text-[var(--flat-text-faint)]"
            />
          </div>
        </SheetSection>

        <SheetError message={formError} />
      </div>
    </BottomSheet>
  );
}
