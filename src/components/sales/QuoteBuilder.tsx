'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Link2, Plus, Trash2, Unlink, X } from 'lucide-react';
import { useBookings } from '@/hooks/useBookings';
import { useCachedData } from '@/hooks/useCachedData';
import type { Booking } from '@/lib/bookingTypes';
import { ApiError } from '@/lib/apiClient';
import { createQuote, updateQuote, type QuoteDto } from '@/lib/quotesApi';
import { INVENTORY_KEY, listInventory, type InventoryItemDto } from '@/lib/inventoryApi';
import { formatCents } from '@/lib/money';
import { adjustmentCents } from '@/lib/quoteCalculator';
import { formatBp, parsePriceToCents, parseQuantity, priceToInput } from '@/lib/sales/inputs';
import type { QuoteDefaults } from '@/lib/sales/defaults';
import { ADJUSTMENT_TYPES, ADJUSTMENT_TYPE_LABELS, QUOTE_PAYMENT_METHOD_LABELS, QUOTE_PAYMENT_METHODS, SECTION_PRESETS, type AdjustmentType, type QuotePaymentMethod } from '@/lib/sales/types';
import {
  blankDraft,
  blankItem,
  blankSection,
  draftFromQuote,
  draftToValues,
  mapServerErrors,
  parseAdjustment,
  previewTotals,
  type DraftErrors,
  type ItemDraft,
  type QuoteDraft,
  type SectionDraft,
} from '@/lib/sales/quoteDraft';
import { clearStoredDraft, readStoredDraft, writeStoredDraft, type DraftSlot } from '@/lib/sales/quoteDraftStore';
import InventoryPicker from './InventoryPicker';
import { buttonClass, Card, DateInput, documentDate, Eyebrow, Field, inputClass, Notice } from './ui';

type Props =
  | { mode: 'create'; defaults: QuoteDefaults; today: string; initialEventId?: number | null }
  | { mode: 'edit'; quote: QuoteDto };

function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// Fills the event details from a booking, and the customer details only
// where they are still blank (never overwriting what was typed).
function linkBooking(d: QuoteDraft, b: Booking): QuoteDraft {
  return {
    ...d,
    eventId: b.id,
    eventName: b.eventTitle,
    eventDate: b.eventDate,
    venueName: b.venueName,
    venueAddress: b.venueAddress,
    customerName: d.customerName.trim() ? d.customerName : b.clientName,
    customerEmail: d.customerEmail.trim() ? d.customerEmail : b.clientEmail,
    customerPhone: d.customerPhone.trim() ? d.customerPhone : b.clientPhone,
  };
}

export default function QuoteBuilder(props: Props) {
  const router = useRouter();
  const editing = props.mode === 'edit';
  // Generated once, so a retried save can't create a second quote.
  const [newId, setNewId] = useState(() => crypto.randomUUID());
  const startingDraft = () => (props.mode === 'edit' ? draftFromQuote(props.quote) : blankDraft(props.defaults, props.today));
  const [draft, setDraft] = useState<QuoteDraft>(startingDraft);
  // The draft as loaded (or recovered); anything else is unsaved work, kept
  // on this device until it's saved or cancelled.
  const [baseline, setBaseline] = useState(draft);
  const [recoveredAt, setRecoveredAt] = useState<number | null>(null);
  const [version, setVersion] = useState(props.mode === 'edit' ? props.quote.updatedAt : '');
  const [errors, setErrors] = useState<DraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<QuoteDto | null>(null);
  const [saving, setSaving] = useState(false);
  const { bookings } = useBookings();
  // The price list item names are picked from; typing still works without it.
  const { data: inventory } = useCachedData(INVENTORY_KEY, listInventory);

  // Opened from a booking (?event=12): link it once the bookings arrive.
  const [pendingEventId, setPendingEventId] = useState(props.mode === 'create' ? (props.initialEventId ?? null) : null);
  if (pendingEventId !== null && bookings.length > 0) {
    const booking = bookings.find((b) => b.id === pendingEventId);
    setPendingEventId(null);
    if (booking) {
      const linked = linkBooking(draft, booking);
      setDraft(linked);
      setBaseline(linked);
    }
  }

  // Unsaved work from a page that was closed by mistake. Read after mount:
  // storage only exists in the browser, and the server render must match.
  const editId = props.mode === 'edit' ? props.quote.id : null;
  const slot: DraftSlot = editId ? { mode: 'edit', quoteId: editId } : { mode: 'create' };
  useEffect(() => {
    const stored = readStoredDraft(editId ? { mode: 'edit', quoteId: editId } : { mode: 'create' });
    if (!stored) return;
    /* eslint-disable react-hooks/set-state-in-effect -- one-time recovery from browser storage */
    setDraft(stored.draft);
    setBaseline(stored.draft);
    if (stored.newId) setNewId(stored.newId);
    if (stored.version) setVersion(stored.version);
    setPendingEventId(null);
    setRecoveredAt(stored.savedAt);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [editId]);

  useEffect(() => {
    if (draft === baseline) return;
    writeStoredDraft(editId ? { mode: 'edit', quoteId: editId } : { mode: 'create' }, editId ? { draft, version } : { draft, newId });
  }, [draft, baseline, editId, version, newId]);

  const totals = useMemo(() => previewTotals(draft), [draft]);
  const cancelHref = props.mode === 'edit' ? `/quotes/${props.quote.id}` : '/quotes';

  // An error disappears as soon as its field is edited; the summary banner
  // goes with the last one (a save conflict stays until resolved).
  const clearErrors = (...keys: string[]) => {
    if (!keys.some((k) => k in errors)) return;
    const next = { ...errors };
    for (const k of keys) delete next[k];
    setErrors(next);
    if (Object.keys(next).length === 0 && !conflict) setFormError(null);
  };
  const set = <K extends keyof QuoteDraft>(key: K, value: QuoteDraft[K]) => {
    clearErrors(key === 'taxRate' ? 'taxRate' : key, key === 'quoteDate' ? 'validUntil' : '');
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const setSection = (key: string, change: (s: SectionDraft) => SectionDraft) => setDraft((d) => ({ ...d, sections: d.sections.map((s) => (s.key === key ? change(s) : s)) }));
  const setItem = (sectionKey: string, itemKey: string, change: Partial<ItemDraft>) => {
    clearErrors(...Object.keys(change).map((field) => `item:${itemKey}:${field}`));
    setSection(sectionKey, (s) => ({ ...s, items: s.items.map((i) => (i.key === itemKey ? { ...i, ...change } : i)) }));
  };

  const sortedBookings = useMemo(() => [...bookings].sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || '')), [bookings]);
  const linkedMissing = draft.eventId !== null && bookings.length > 0 && !bookings.some((b) => b.id === draft.eventId);

  async function save() {
    setFormError(null);
    setConflict(null);
    const result = draftToValues(draft);
    setErrors(result.errors);
    if (!result.values) {
      setFormError('Some fields need fixing — they are highlighted below.');
      return;
    }
    setSaving(true);
    try {
      const saved = props.mode === 'edit' ? await updateQuote(props.quote.id, result.values, version) : await createQuote(newId, result.values);
      clearStoredDraft(slot);
      // Back from the details should return to the list, not to this form.
      router.replace(`/quotes/${saved.id}`);
    } catch (err) {
      setSaving(false);
      if (err instanceof ApiError) {
        setErrors(mapServerErrors(err.fieldErrors, result.itemKeys));
        setFormError(err.message);
        if (err.status === 409 && err.current) setConflict(err.current as QuoteDto);
      } else {
        setFormError('Could not save the quote. Please try again.');
      }
    }
  }

  function loadTheirVersion() {
    if (!conflict) return;
    const latest = draftFromQuote(conflict);
    setDraft(latest);
    setBaseline(latest);
    clearStoredDraft(slot);
    setVersion(conflict.updatedAt);
    setConflict(null);
    setFormError(null);
    setErrors({});
  }

  function startOver() {
    const fresh = startingDraft();
    clearStoredDraft(slot);
    setDraft(fresh);
    setBaseline(fresh);
    if (props.mode === 'edit') setVersion(props.quote.updatedAt);
    else setPendingEventId(props.initialEventId ?? null);
    setRecoveredAt(null);
    setErrors({});
    setFormError(null);
    setConflict(null);
  }

  function cancel() {
    clearStoredDraft(slot);
    router.push(cancelHref);
  }

  const presetsLeft = SECTION_PRESETS.filter((p) => !draft.sections.some((s) => s.name.trim().toLowerCase() === p.toLowerCase()));

  return (
    // Phones: one column — the form, Totals, Notes & terms, then Save/Cancel
    // (ordered with `order-*`). Desktop: the form and notes on the left, and
    // Totals + Save/Cancel in a right-hand panel that stays in view.
    <div className="grid gap-4 pb-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="space-y-4 lg:col-start-1 lg:row-start-1">
        {recoveredAt !== null ? (
          <Notice tone="info">
            <p>
              Restored the unsaved {editing ? 'changes' : 'quote'} from {new Date(recoveredAt).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}. Save to keep {editing ? 'them' : 'it'}.
            </p>
            <button type="button" onClick={startOver} className="mt-1 font-semibold underline">
              {editing ? 'Discard these changes' : 'Start over with a blank quote'}
            </button>
          </Notice>
        ) : null}
        {formError ? (
          <Notice>
            <p>{formError}</p>
            {conflict ? (
              <button type="button" onClick={loadTheirVersion} className="mt-1 font-semibold underline">
                Load the latest version (discards your changes)
              </button>
            ) : null}
          </Notice>
        ) : null}

        <Card>
          <Eyebrow>Customer</Eyebrow>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Customer name" error={errors.customerName}>
              <input className={inputClass} value={draft.customerName} onChange={(e) => set('customerName', e.target.value)} aria-invalid={!!errors.customerName} autoComplete="off" />
            </Field>
            <Field label="Company (optional)">
              <input className={inputClass} value={draft.customerCompany} onChange={(e) => set('customerCompany', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Email" error={errors.customerEmail}>
              <input className={inputClass} type="email" inputMode="email" value={draft.customerEmail} onChange={(e) => set('customerEmail', e.target.value)} aria-invalid={!!errors.customerEmail} autoComplete="off" />
            </Field>
            <Field label="Phone">
              <input className={inputClass} type="tel" value={draft.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Billing address" className="md:col-span-2">
              <textarea className={`${inputClass} min-h-[64px] resize-y`} rows={2} value={draft.billingAddress} onChange={(e) => set('billingAddress', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <Eyebrow>Event</Eyebrow>
          <Field label="Link an existing booking (optional)" error={errors.eventId} hint={draft.eventId ? 'Linked — the details below are a copy, so later booking changes won’t alter this quote.' : 'Fills in the event and any blank customer details.'}>
            <div className="flex gap-2">
              <select
                className={inputClass}
                value={draft.eventId ?? ''}
                onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null;
                  const booking = bookings.find((b) => b.id === id);
                  setDraft((d) => (booking ? linkBooking(d, booking) : { ...d, eventId: null }));
                }}
              >
                <option value="">No linked booking</option>
                {linkedMissing ? <option value={draft.eventId!}>Deleted booking #{draft.eventId}</option> : null}
                {sortedBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.eventTitle || 'Untitled event'} — {b.eventDate ? documentDate(b.eventDate) : 'no date'}
                    {b.clientName ? ` · ${b.clientName}` : ''}
                  </option>
                ))}
              </select>
              {draft.eventId ? (
                <button type="button" onClick={() => set('eventId', null)} className={buttonClass('secondary', 'shrink-0 px-3')} aria-label="Unlink booking" title="Unlink booking">
                  <Unlink size={16} />
                </button>
              ) : (
                <span className="flex shrink-0 items-center px-1 text-[var(--ink-3)]" aria-hidden>
                  <Link2 size={16} />
                </span>
              )}
            </div>
          </Field>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Event name">
              <input className={inputClass} value={draft.eventName} onChange={(e) => set('eventName', e.target.value)} />
            </Field>
            <Field label="Event date" hint="Leave blank if not confirmed (shows as TBC)">
              <DateInput value={draft.eventDate} onChange={(v) => set('eventDate', v)} />
            </Field>
            <Field label="Venue">
              <input className={inputClass} value={draft.venueName} onChange={(e) => set('venueName', e.target.value)} />
            </Field>
            <Field label="Venue address">
              <input className={inputClass} value={draft.venueAddress} onChange={(e) => set('venueAddress', e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <Eyebrow aside={editing ? props.quote.quoteNumber : 'Number assigned on save'}>Quote details</Eyebrow>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quote date" error={errors.quoteDate}>
              <DateInput value={draft.quoteDate} onChange={(v) => set('quoteDate', v)} invalid={!!errors.quoteDate} />
            </Field>
            <Field label="Valid until" error={errors.validUntil}>
              <DateInput value={draft.validUntil} min={draft.quoteDate || undefined} onChange={(v) => set('validUntil', v)} invalid={!!errors.validUntil} />
            </Field>
          </div>
        </Card>

        <div className="space-y-3">
          <div className="flex items-end justify-between px-1">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-2)] before:mb-1.5 before:block before:h-[3px] before:w-5 before:rounded-full before:bg-[var(--accent)]">Items</h2>
            {errors.items ? <span className="text-[12px] text-[var(--bad)]">{errors.items}</span> : null}
          </div>
          {draft.sections.map((section, sectionIndex) => (
            <SectionEditor
              key={section.key}
              section={section}
              errors={errors}
              isFirst={sectionIndex === 0}
              isLast={sectionIndex === draft.sections.length - 1}
              onRename={(name) => {
                clearErrors(`section:${section.key}`);
                setSection(section.key, (s) => ({ ...s, name }));
              }}
              onMove={(delta) => setDraft((d) => ({ ...d, sections: move(d.sections, sectionIndex, delta) }))}
              onRemove={() => setDraft((d) => ({ ...d, sections: d.sections.filter((s) => s.key !== section.key) }))}
              onAddItem={() => {
                clearErrors('items');
                setSection(section.key, (s) => ({ ...s, items: [...s.items, blankItem()] }));
              }}
              inventory={inventory ?? []}
              onItemChange={(itemKey, change) => setItem(section.key, itemKey, change)}
              onItemPick={(itemKey, picked) => {
                setItem(section.key, itemKey, { itemName: picked.itemName, description: picked.description ?? '', unitPrice: priceToInput(picked.unitPriceCents) });
                // An unnamed section takes the picked item's section.
                if (!section.name.trim()) {
                  clearErrors(`section:${section.key}`);
                  setSection(section.key, (s) => ({ ...s, name: picked.section }));
                }
              }}
              onItemMove={(itemIndex, delta) => setSection(section.key, (s) => ({ ...s, items: move(s.items, itemIndex, delta) }))}
              onItemRemove={(itemKey) => setSection(section.key, (s) => ({ ...s, items: s.items.filter((i) => i.key !== itemKey) }))}
            />
          ))}
          <Card className="border-dashed">
            <p className="text-[12px] font-medium text-[var(--ink-2)]">Add a section</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {presetsLeft.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, sections: [...d.sections, blankSection(name)] }))}
                  className="rounded-full border border-[var(--line-strong)] px-3 py-1 text-[13px] font-medium text-[var(--ink-2)] transition hover:border-[var(--accent)] hover:text-[var(--accent-ink)]"
                >
                  + {name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, sections: [...d.sections, blankSection('')] }))}
                className="rounded-full border border-dashed border-[var(--line-strong)] px-3 py-1 text-[13px] font-medium text-[var(--ink-2)] transition hover:border-[var(--accent)] hover:text-[var(--accent-ink)]"
              >
                + Custom section
              </button>
            </div>
          </Card>
        </div>
      </div>

      <Card className="order-3 lg:order-none lg:col-start-1 lg:row-start-2">
        <Eyebrow>Notes &amp; terms</Eyebrow>
        <div className="space-y-3">
          <Field label="Notes (shown on the quote)" error={errors.notes}>
            <textarea className={`${inputClass} min-h-[72px] resize-y`} rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
          <Field label="Terms & conditions" hint="One term per line." error={errors.terms}>
            <textarea className={`${inputClass} min-h-[140px] resize-y`} rows={6} value={draft.terms} onChange={(e) => set('terms', e.target.value)} />
          </Field>
          {/* Printed beside the totals on the PDF; off = questions and a thank-you only. */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--paper-sunk)] px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
              checked={draft.showPaymentDetails}
              onChange={(e) => set('showPaymentDetails', e.target.checked)}
            />
            <span>
              <span className="block text-[14px] font-medium">Show payment details on the PDF</span>
              <span className="block text-[12px] text-[var(--ink-3)]">Payment methods, e-transfer and card information beside the totals.</span>
            </span>
          </label>
        </div>
      </Card>

      {/* On phones the panel itself disappears (contents) so Totals and the
          buttons can take their own places in the order above. */}
      {/* Desktop: a grey tray holding the white Totals card, with Save under it. */}
      <aside className="contents lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block lg:self-start lg:rounded-[28px] lg:bg-[var(--tray)] lg:p-2">
        <Card className="order-2 lg:order-none lg:rounded-[22px] lg:border-0 lg:shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <Eyebrow>Totals</Eyebrow>
          {/* Decides the tax (cash = no HST) and what the PDF lists under payment. */}
          <Field label="Payment method" className="mb-4">
            <select
              className={inputClass}
              value={draft.paymentMethod ?? ''}
              onChange={(e) => set('paymentMethod', (e.target.value || null) as QuotePaymentMethod | null)}
            >
              <option value="">Not specified (list all methods)</option>
              {QUOTE_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {QUOTE_PAYMENT_METHOD_LABELS[m]}
                  {m === 'cash' ? ' (no HST)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <dl className="space-y-3 text-[14px]">
            {totals.itemDiscountsCents > 0 ? (
              <>
                <Row label="Items" value={formatCents(totals.subtotalCents + totals.itemDiscountsCents)} />
                <Row label="Item discounts" value={`−${formatCents(totals.itemDiscountsCents)}`} />
              </>
            ) : null}
            <Row label="Subtotal" value={formatCents(totals.subtotalCents)} />
            <AdjustmentRow
              label="Discount"
              note="before HST"
              type={draft.discountType}
              value={draft.discountValue}
              error={errors.discountValue}
              amount={totals.discountCents > 0 ? `−${formatCents(totals.discountCents)}` : formatCents(0)}
              onType={(t) => {
                clearErrors('discountValue');
                setDraft((d) => ({ ...d, discountType: t, discountValue: t === 'none' ? '' : t === d.discountType ? d.discountValue : '' }));
              }}
              onValue={(v) => set('discountValue', v)}
            />
            {draft.paymentMethod === 'cash' ? (
              // The typed rate is kept (not shown) so switching back restores it.
              <Row label={`No ${draft.taxLabel || 'HST'} on cash`} value={formatCents(0)} />
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <dt className="flex min-w-0 flex-1 items-center gap-1.5 text-[var(--ink-2)]">
                    <span className="w-16 shrink-0">
                      <input
                        aria-label="Tax name"
                        className={`${inputClass} px-2 py-1`}
                        value={draft.taxLabel}
                        onChange={(e) => set('taxLabel', e.target.value)}
                        aria-invalid={!!errors.taxLabel}
                      />
                    </span>
                    <span className="relative w-20 shrink-0">
                      <input
                        aria-label="Tax rate (%)"
                        inputMode="decimal"
                        className={`${inputClass} py-1 pl-2 pr-6`}
                        value={draft.taxRate}
                        onChange={(e) => set('taxRate', e.target.value)}
                        aria-invalid={!!errors.taxRate}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">%</span>
                    </span>
                  </dt>
                  <dd className="tabular-nums">{formatCents(totals.taxCents)}</dd>
                </div>
                {errors.taxRate || errors.taxLabel ? <p className="mt-1 text-[12px] text-[var(--bad)]">{errors.taxRate ?? errors.taxLabel}</p> : null}
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-[var(--line)] pt-3">
              <dt className="text-[13px] font-bold uppercase tracking-[0.06em]">Total</dt>
              <dd className="text-[22px] font-bold tabular-nums text-[var(--accent-ink)]">{formatCents(totals.totalCents)}</dd>
            </div>
            <AdjustmentRow
              label="Deposit required"
              type={draft.depositType}
              value={draft.depositValue}
              error={errors.depositValue}
              amount={formatCents(totals.depositRequiredCents)}
              onType={(t) => {
                clearErrors('depositValue');
                setDraft((d) => ({ ...d, depositType: t, depositValue: t === 'none' ? '' : t === d.depositType ? d.depositValue : '' }));
              }}
              onValue={(v) => set('depositValue', v)}
            />
          </dl>
          <p className="mt-3 text-[12px] leading-snug text-[var(--ink-3)]">
            Item discounts come off their own line; the discount above comes off the whole subtotal. {draft.taxLabel || 'Tax'} is charged after both. Totals are recalculated on the server when you save.
          </p>
        </Card>

        <div className="order-4 space-y-1 lg:order-none lg:px-1 lg:pt-3">
          <button type="button" onClick={save} className={buttonClass('primary', 'w-full py-3.5 text-[16px]')} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save draft'}
          </button>
          <button type="button" onClick={cancel} className={buttonClass('ghost', 'w-full py-3 text-[15px]')} disabled={saving}>
            Cancel
          </button>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-[var(--ink-2)]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

// Discount / deposit: None, a percentage, or a fixed dollar amount.
function AdjustmentRow({
  label,
  note,
  type,
  value,
  error,
  amount,
  onType,
  onValue,
}: {
  label: string;
  note?: string;
  type: AdjustmentType;
  value: string;
  error?: string;
  amount: string;
  onType: (t: AdjustmentType) => void;
  onValue: (v: string) => void;
}) {
  const parsed = parseAdjustment(type, value);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <dt className="text-[var(--ink-2)]">
          {label}
          {note ? <span className="text-[var(--ink-3)]"> · {note}</span> : null}
          {type === 'percent' && parsed.ok && value ? <span className="text-[var(--ink-3)]"> ({formatBp(parsed.value)})</span> : null}
        </dt>
        <dd className="tabular-nums">{type === 'none' ? '—' : amount}</dd>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <span className={type === 'none' ? 'w-full' : 'w-36 shrink-0'}>
          <select aria-label={`${label} type`} className={`${inputClass} py-1`} value={type} onChange={(e) => onType(e.target.value as AdjustmentType)}>
            {ADJUSTMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ADJUSTMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </span>
        {type !== 'none' ? (
          <span className="relative min-w-0 flex-1">
            {type === 'fixed' ? <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">$</span> : null}
            <input
              aria-label={`${label} ${type === 'percent' ? '(%)' : '($)'}`}
              inputMode="decimal"
              className={`${inputClass} py-1 ${type === 'fixed' ? 'pl-5' : 'pr-6'}`}
              value={value}
              onChange={(e) => onValue(e.target.value)}
              aria-invalid={!!error}
            />
            {type === 'percent' ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">%</span> : null}
          </span>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-[12px] text-[var(--bad)]">{error}</p> : null}
    </div>
  );
}

function SectionEditor({
  section,
  errors,
  isFirst,
  isLast,
  onRename,
  onMove,
  onRemove,
  onAddItem,
  inventory,
  onItemChange,
  onItemPick,
  onItemMove,
  onItemRemove,
}: {
  section: SectionDraft;
  errors: DraftErrors;
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onAddItem: () => void;
  inventory: InventoryItemDto[];
  onItemChange: (itemKey: string, change: Partial<ItemDraft>) => void;
  onItemPick: (itemKey: string, item: InventoryItemDto) => void;
  onItemMove: (index: number, delta: -1 | 1) => void;
  onItemRemove: (itemKey: string) => void;
}) {
  const sectionError = errors[`section:${section.key}`];
  const listId = `section-presets-${section.key}`;
  return (
    // Not overflow-hidden: the inventory picker's list drops below the card.
    <Card padded={false}>
      {/* Section header, like the grey band with an orange marker on the PDF. */}
      <div className="flex items-center gap-2 rounded-t-2xl border-b border-[var(--line)] bg-[var(--paper-sunk)] px-3 py-2">
        <span className="h-4 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
        <input
          aria-label="Section name"
          placeholder="Section name"
          list={listId}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[16px] font-bold uppercase tracking-[0.04em] outline-none focus:border-[var(--line-strong)] focus:bg-[var(--paper)] md:text-[13px] aria-[invalid=true]:border-[var(--bad)]"
          value={section.name}
          onChange={(e) => onRename(e.target.value)}
          aria-invalid={!!sectionError}
        />
        <datalist id={listId}>
          {SECTION_PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <IconButton label="Move section up" onClick={() => onMove(-1)} disabled={isFirst}>
          <ArrowUp size={15} />
        </IconButton>
        <IconButton label="Move section down" onClick={() => onMove(1)} disabled={isLast}>
          <ArrowDown size={15} />
        </IconButton>
        <IconButton label="Remove section" onClick={onRemove}>
          <Trash2 size={15} />
        </IconButton>
      </div>
      {sectionError ? <p className="px-4 pt-2 text-[12px] text-[var(--bad)]">{sectionError}</p> : null}

      {/* Column labels (desktop). */}
      {section.items.length > 0 ? (
        <div className="hidden grid-cols-[minmax(0,1fr)_72px_120px_110px_96px] gap-2 px-4 pt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)] md:grid">
          <span>Item</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span className="text-right">Total</span>
          <span />
        </div>
      ) : null}
      <ul className="divide-y divide-[var(--line)]">
        {section.items.map((item, index) => (
          <ItemEditor
            key={item.key}
            item={item}
            section={section.name}
            inventory={inventory}
            errors={errors}
            isFirst={index === 0}
            isLast={index === section.items.length - 1}
            onChange={(change) => onItemChange(item.key, change)}
            onPick={(picked) => onItemPick(item.key, picked)}
            onMove={(delta) => onItemMove(index, delta)}
            onRemove={() => onItemRemove(item.key)}
          />
        ))}
      </ul>
      <div className="border-t border-[var(--line)] px-3 py-2">
        <button type="button" onClick={onAddItem} className={buttonClass('ghost', 'px-2 py-1.5 text-[13px]')}>
          <Plus size={15} /> Add item
        </button>
      </div>
    </Card>
  );
}

function ItemEditor({
  item,
  section,
  inventory,
  errors,
  isFirst,
  isLast,
  onChange,
  onPick,
  onMove,
  onRemove,
}: {
  item: ItemDraft;
  section: string;
  inventory: InventoryItemDto[];
  errors: DraftErrors;
  isFirst: boolean;
  isLast: boolean;
  onChange: (change: Partial<ItemDraft>) => void;
  onPick: (item: InventoryItemDto) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const err = (field: string) => errors[`item:${item.key}:${field}`];
  const qty = parseQuantity(item.quantity);
  const price = parsePriceToCents(item.unitPrice);
  const gross = qty.ok && price.ok ? qty.value * price.value : null;
  const discount = parseAdjustment(item.discountType, item.discountValue);
  const discountCents = gross !== null && discount.ok ? adjustmentCents(gross, { type: item.discountType, value: discount.value }) : 0;
  return (
    <li className="grid grid-cols-[1fr_1fr_1fr] gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_72px_120px_110px_96px] md:items-start">
      <div className="col-span-3 space-y-1.5 md:col-span-1">
        <InventoryPicker
          value={item.itemName}
          section={section}
          inventory={inventory}
          invalid={!!err('itemName')}
          onType={(itemName) => onChange({ itemName })}
          onPick={onPick}
        />
        <input
          aria-label="Description"
          placeholder="Description (optional)"
          className={`${inputClass} text-[var(--ink-2)]`}
          value={item.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
        {err('itemName') ? <p className="text-[12px] text-[var(--bad)]">{err('itemName')}</p> : null}
        <ItemDiscount item={item} amountCents={discountCents} error={err('discountValue')} onChange={onChange} />
      </div>
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-[var(--ink-3)] md:hidden">Qty</span>
        <input aria-label="Quantity" inputMode="numeric" className={inputClass} value={item.quantity} onChange={(e) => onChange({ quantity: e.target.value })} aria-invalid={!!err('quantity')} />
        {err('quantity') ? <span className="mt-1 block text-[12px] text-[var(--bad)]">{err('quantity')}</span> : null}
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-medium text-[var(--ink-3)] md:hidden">Unit price</span>
        <span className="relative block">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">$</span>
          <input aria-label="Unit price" inputMode="decimal" placeholder="0.00" className={`${inputClass} pl-6`} value={item.unitPrice} onChange={(e) => onChange({ unitPrice: e.target.value })} aria-invalid={!!err('unitPrice')} />
        </span>
        {err('unitPrice') ? <span className="mt-1 block text-[12px] text-[var(--bad)]">{err('unitPrice')}</span> : null}
      </label>
      <div className="text-right">
        <span className="mb-1 block text-[11px] font-medium text-[var(--ink-3)] md:hidden">Total</span>
        {/* The net line amount; the original is struck through when discounted. */}
        <span className="block py-2 text-[15px] font-semibold tabular-nums md:text-[14px]">
          {gross === null ? '—' : formatCents(gross - discountCents)}
          {discountCents > 0 ? <span className="block text-[12px] font-normal text-[var(--ink-3)] line-through">{formatCents(gross!)}</span> : null}
        </span>
      </div>
      <div className="col-span-3 flex justify-end gap-0.5 md:col-span-1 md:pt-1">
        <IconButton label="Move item up" onClick={() => onMove(-1)} disabled={isFirst}>
          <ArrowUp size={15} />
        </IconButton>
        <IconButton label="Move item down" onClick={() => onMove(1)} disabled={isLast}>
          <ArrowDown size={15} />
        </IconButton>
        <IconButton label="Remove item" onClick={onRemove}>
          <Trash2 size={15} />
        </IconButton>
      </div>
    </li>
  );
}

// A discount on one line: hidden behind "+ Discount" until wanted, then a
// percentage or fixed amount, with a button to take it off again.
function ItemDiscount({ item, amountCents, error, onChange }: { item: ItemDraft; amountCents: number; error?: string; onChange: (change: Partial<ItemDraft>) => void }) {
  if (item.discountType === 'none') {
    return (
      <button
        type="button"
        onClick={() => onChange({ discountType: 'percent', discountValue: '' })}
        className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[12px] font-medium text-[var(--ink-3)] transition hover:text-[var(--accent-ink)]"
      >
        <Plus size={13} /> Discount
      </button>
    );
  }
  const percent = item.discountType === 'percent';
  return (
    <div>
      {/* Compact enough to sit on one line under the item name. */}
      <div className="flex items-center gap-1.5">
        <span className="w-[84px] shrink-0">
          <select
            aria-label="Item discount type"
            className={`${inputClass} py-1`}
            value={item.discountType}
            onChange={(e) => onChange({ discountType: e.target.value as AdjustmentType, discountValue: '' })}
          >
            <option value="percent">% off</option>
            <option value="fixed">$ off</option>
          </select>
        </span>
        <span className="relative w-[84px] shrink-0">
          {percent ? null : <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">$</span>}
          <input
            aria-label={`Item discount ${percent ? '(%)' : '($)'}`}
            inputMode="decimal"
            className={`${inputClass} py-1 ${percent ? 'pr-6' : 'pl-5'}`}
            value={item.discountValue}
            onChange={(e) => onChange({ discountValue: e.target.value })}
            aria-invalid={!!error}
          />
          {percent ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink-3)]">%</span> : null}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] tabular-nums text-[var(--bad)]">{amountCents > 0 ? `−${formatCents(amountCents)}` : ''}</span>
        <IconButton label="Remove item discount" onClick={() => onChange({ discountType: 'none', discountValue: '' })}>
          <X size={14} />
        </IconButton>
      </div>
      {error ? <p className="mt-1 text-[12px] text-[var(--bad)]">{error}</p> : null}
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--ink-3)] transition hover:bg-[var(--paper)] hover:text-[var(--ink)] disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
