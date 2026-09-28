'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Banknote, Building2, Camera, ChevronDown, CreditCard, FileText, Loader2, Send, Trash2, X } from 'lucide-react';
import { CATEGORY_META } from './categoryMeta';
import ReimbursementPanel from './ReimbursementPanel';
import AmountKeypad from './AmountKeypad';
import DateChip from '@/components/ui/DateChip';
import { colorAlpha } from '@/lib/colorAlpha';
import {
  ApiError,
  createExpense,
  deleteExpense,
  expensesKey,
  FINANCE_PARTNERS_KEY,
  getExpense,
  getPartners,
  listExpenses,
  receiptUrl,
  restoreExpense,
  updateExpense,
  uploadReceipt,
  type ExpenseDetailDto,
  type ExpenseDto,
  type ExpenseFormValues,
  type PartnerOption,
} from '@/lib/financeApi';
import { BOOKINGS_KEY, listBookings } from '@/lib/bookingsApi';
import { loadCached, peekCache } from '@/lib/clientCache';
import type { Booking } from '@/lib/bookingTypes';
import { centsToInput, formatCents, parseAmountToCents } from '@/lib/money';
import { hstIncluded } from '@/lib/finance/tax';
import { defaultFundingSource } from '@/lib/finance/reimbursement';
import { findLikelyDuplicate } from '@/lib/finance/duplicates';
import { addDays, friendlyDate, todayLocal } from '@/lib/finance/dates';
import { readExpensePrefs, writeExpensePrefs } from '@/lib/devicePrefs';
import { prepareReceipt } from '@/lib/receiptImage';
import { applyKeypadKey, formatKeypadAmount, keypadKeyFromKeyboard, type KeypadKey } from '@/lib/amountKeypad';
import { DEFAULT_HST_RATE_BP, EXPENSE_CATEGORIES, PAYMENT_METHOD_LABELS, type ExpenseCategory, type FundingSource, type PaymentMethod } from '@/lib/finance/types';

type Request = { mode: 'new'; bookingId: number | null } | { mode: 'edit'; expenseId: string };

interface Props {
  request: Request;
  onClose: () => void;
  onChanged: () => void;
  showToast: (t: { message: string; actionLabel?: string; onAction?: () => Promise<void> | void }) => void;
}

const PAYMENT_ICONS: Record<PaymentMethod, typeof CreditCard> = {
  personal_card: CreditCard,
  company_card: Building2,
  cash: Banknote,
  etransfer: Send,
};
const PAYMENT_ORDER: PaymentMethod[] = ['personal_card', 'company_card', 'cash', 'etransfer'];

type ReceiptState =
  | { status: 'none' }
  | { status: 'working'; previewUrl: string | null; isPdf: boolean }
  | { status: 'ready'; attachmentId: string; previewUrl: string | null; isPdf: boolean; duplicateOfExpenseId: string | null }
  | { status: 'error'; message: string };

function partnerLabel(p: { email: string; name: string | null }): string {
  if (p.name) return p.name.split(' ')[0];
  const local = p.email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function initials(p: { email: string; name: string | null }): string {
  if (!p.name) return p.email.charAt(0).toUpperCase() || '?';
  const parts = p.name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function ExpenseSheet({ request, onClose, onChanged, showToast }: Props) {
  const titleId = useId();
  const isEdit = request.mode === 'edit';
  const today = todayLocal();
  const prefs = useMemo(() => readExpensePrefs(), []);

  // A fresh id per new expense: a retried save re-sends the same id and the
  // server returns the existing record instead of creating a duplicate.
  const [expenseId] = useState(() => (request.mode === 'edit' ? request.expenseId : crypto.randomUUID()));
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState<string | null>(null);
  const [detail, setDetail] = useState<ExpenseDetailDto | null>(null);

  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [bookingId, setBookingId] = useState<number | null>(request.mode === 'new' ? request.bookingId : null);
  const [paidByEmail, setPaidByEmail] = useState(() => (request.mode === 'new' ? (peekCache<{ me: string }>(FINANCE_PARTNERS_KEY)?.me ?? '') : ''));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(prefs.paymentMethod ?? 'personal_card');
  const [cashLikeFunding, setCashLikeFunding] = useState<FundingSource>(prefs.fundingForCashLike ?? 'personal');
  const [waiveReimbursement, setWaiveReimbursement] = useState(false);
  const [expenseDate, setExpenseDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [receiptShowsHst, setReceiptShowsHst] = useState(false);
  const [taxText, setTaxText] = useState('');
  const [taxTouched, setTaxTouched] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptState>({ status: 'none' });
  const receiptUpload = useRef<Promise<string | null> | null>(null);

  // Reference data: whatever is cached shows at once (partner chips, event
  // list, duplicate check); fresh copies load behind it.
  const recentFilter = { from: addDays(today, -45) };
  const [partners, setPartners] = useState<PartnerOption[]>(() => peekCache<{ partners: PartnerOption[] }>(FINANCE_PARTNERS_KEY)?.partners ?? []);
  const [me, setMe] = useState(() => peekCache<{ me: string }>(FINANCE_PARTNERS_KEY)?.me ?? '');
  const [bookings, setBookings] = useState<Booking[]>(() => peekCache<Booking[]>(BOOKINGS_KEY) ?? []);
  const [recent, setRecent] = useState<ExpenseDto[]>(() => peekCache<ExpenseDto[]>(expensesKey(recentFilter)) ?? []);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [open, setOpen] = useState(false);
  // The in-app amount keypad. A new expense starts on it so you can type
  // straight away without the phone keyboard; an edit starts on the form.
  const [keypadOpen, setKeypadOpen] = useState(!isEdit);

  // Slide in; lock page scroll behind the sheet.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = previous;
    };
  }, []);

  // Reference data. The form is usable immediately; these fill in behind it.
  useEffect(() => {
    loadCached(FINANCE_PARTNERS_KEY, getPartners)
      .then(({ me, partners }) => {
        setPartners(partners);
        setMe(me);
        setPaidByEmail((current) => current || me);
      })
      .catch((err) => setFormError(err instanceof Error ? err.message : 'Could not load partners'));
    loadCached(BOOKINGS_KEY, listBookings)
      .then(setBookings)
      .catch(() => {});
    const recentQuery = { from: addDays(today, -45) };
    loadCached(expensesKey(recentQuery), () => listExpenses(recentQuery))
      .then(setRecent)
      .catch(() => {});
  }, [today]);

  function fillFrom(e: ExpenseDetailDto) {
    setAmountText(centsToInput(e.amountCents));
    setCategory(e.category);
    setBookingId(e.bookingId);
    setPaidByEmail(e.paidByEmail);
    setPaymentMethod(e.paymentMethod);
    if (e.paymentMethod === 'cash' || e.paymentMethod === 'etransfer') setCashLikeFunding(e.fundingSource);
    setWaiveReimbursement(e.fundingSource === 'personal' && !e.reimbursable);
    setExpenseDate(e.expenseDate);
    setNotes(e.notes ?? '');
    setShowNotes(Boolean(e.notes));
    setReceiptShowsHst(e.taxCents > 0);
    setTaxText(e.taxCents > 0 ? centsToInput(e.taxCents) : '');
    setTaxTouched(e.taxCents > 0);
    setShowMore(e.taxCents > 0 || (e.fundingSource === 'personal' && !e.reimbursable));
    setReceipt(
      e.receipt
        ? {
            status: 'ready',
            attachmentId: e.receipt.id,
            previewUrl: e.receipt.contentType.startsWith('image/') ? receiptUrl(e.receipt.id) : null,
            isPdf: e.receipt.contentType === 'application/pdf',
            duplicateOfExpenseId: null,
          }
        : { status: 'none' },
    );
    setExpectedUpdatedAt(e.updatedAt);
    setDetail(e);
    setDirty(false);
    setConflict(false);
  }

  useEffect(() => {
    if (request.mode !== 'edit') return;
    getExpense(request.expenseId)
      .then((e) => {
        if (e.deletedAt) throw new Error('This expense was deleted.');
        fillFrom(e);
      })
      .catch((err) => setFormError(err instanceof Error ? err.message : 'Could not load this expense'))
      .finally(() => setLoadingExisting(false));
    // fillFrom only sets state; loading once per opened expense is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touch = () => {
    setDirty(true);
    setFormError(null);
  };

  function pressKey(key: KeypadKey) {
    setAmountText((text) => applyKeypadKey(text, key));
    setFieldErrors((f) => ({ ...f, amountCents: '' }));
    touch();
  }

  // Typing on a computer keyboard works too while the keypad is showing
  // (but never steals keys from the note or HST fields).
  useEffect(() => {
    if (!keypadOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        setKeypadOpen(false);
        return;
      }
      const key = keypadKeyFromKeyboard(e.key);
      if (!key) return;
      e.preventDefault();
      setAmountText((text) => applyKeypadKey(text, key));
      setFieldErrors((f) => ({ ...f, amountCents: '' }));
      setDirty(true);
      setFormError(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [keypadOpen]);

  const parsedAmount = parseAmountToCents(amountText);
  const amountCents = parsedAmount.ok ? parsedAmount.cents : 0;
  const fundingSource: FundingSource =
    paymentMethod === 'cash' || paymentMethod === 'etransfer' ? cashLikeFunding : defaultFundingSource(paymentMethod);
  const reimbursable = fundingSource === 'personal' && !waiveReimbursement;

  // HST shown on the receipt: suggested from the amount until edited by hand.
  const suggestedTax = receiptShowsHst && amountCents > 0 ? hstIncluded(amountCents, DEFAULT_HST_RATE_BP) : 0;
  const parsedTax = taxTouched && taxText.trim() ? parseAmountToCents(taxText) : null;
  const taxCents = !receiptShowsHst ? 0 : parsedTax ? (parsedTax.ok ? parsedTax.cents : -1) : suggestedTax;

  const duplicate = findLikelyDuplicate({ id: isEdit ? expenseId : undefined, amountCents, expenseDate }, recent);

  const eventOptions = useMemo(() => {
    const dayNum = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).getTime() : Number.MAX_SAFE_INTEGER);
    const now = dayNum(today);
    return bookings
      .filter((b) => b.status !== 'Cancelled' || b.id === bookingId)
      .sort((a, b) => Math.abs(dayNum(a.eventDate) - now) - Math.abs(dayNum(b.eventDate) - now));
  }, [bookings, bookingId, today]);

  const partnerOptions = useMemo(() => {
    const list = [...partners];
    // Keep a former partner visible when editing their old expense.
    if (paidByEmail && !list.some((p) => p.email === paidByEmail)) list.push({ email: paidByEmail, name: null, image: null, outstandingCents: 0 });
    return list;
  }, [partners, paidByEmail]);

  async function handleReceipt(file: File) {
    touch();
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    setReceipt({ status: 'working', previewUrl: null, isPdf });
    const upload = (async () => {
      try {
        const prepared = await prepareReceipt(file);
        setReceipt({ status: 'working', previewUrl: prepared.previewUrl, isPdf });
        const attachment = await uploadReceipt(prepared.blob, prepared.filename);
        setReceipt({ status: 'ready', attachmentId: attachment.id, previewUrl: prepared.previewUrl, isPdf, duplicateOfExpenseId: attachment.duplicateOfExpenseId });
        return attachment.id;
      } catch (err) {
        setReceipt({ status: 'error', message: err instanceof Error ? err.message : 'Receipt upload failed' });
        return null;
      }
    })();
    receiptUpload.current = upload;
    await upload;
  }

  function requestClose() {
    if (saving) return;
    setOpen(false);
    window.setTimeout(onClose, 250); // after the slide-down finishes
  }

  async function handleSave() {
    const errors: Record<string, string> = {};
    if (!parsedAmount.ok) errors.amountCents = parsedAmount.error;
    if (!category) errors.category = 'Choose a category';
    if (!paidByEmail) errors.paidByEmail = 'Choose who paid';
    if (receiptShowsHst && (taxCents < 0 || (amountCents > 0 && taxCents >= amountCents))) errors.taxCents = 'HST must be less than the total';
    if (receipt.status === 'error') errors.receipt = 'Retry or remove the receipt';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !category) return;

    setSaving(true);
    setFormError(null);
    try {
      // Wait for a receipt that's still uploading rather than dropping it.
      let receiptAttachmentId = receipt.status === 'ready' ? receipt.attachmentId : null;
      if (receipt.status === 'working' && receiptUpload.current) {
        receiptAttachmentId = await receiptUpload.current;
        if (!receiptAttachmentId) {
          setFieldErrors({ receipt: 'Retry or remove the receipt' });
          return;
        }
      }
      const values: ExpenseFormValues = {
        bookingId,
        category,
        amountCents,
        taxCents: receiptShowsHst ? taxCents : 0,
        expenseDate,
        paidByEmail,
        paymentMethod,
        fundingSource,
        reimbursable,
        notes: notes.trim() || null,
        receiptAttachmentId,
      };

      if (isEdit) {
        if (!expectedUpdatedAt) return;
        await updateExpense(expenseId, values, expectedUpdatedAt);
        onChanged();
        requestClose();
        showToast({ message: 'Changes saved' });
        return;
      }

      const saved = await createExpense(expenseId, values);
      writeExpensePrefs({
        paymentMethod,
        ...(paymentMethod === 'cash' || paymentMethod === 'etransfer' ? { fundingForCashLike: cashLikeFunding } : {}),
      });
      onChanged();
      requestClose();
      showToast({
        message: `Saved ${formatCents(saved.amountCents)} · ${CATEGORY_META[saved.category].short}`,
        actionLabel: 'Undo',
        onAction: async () => {
          await deleteExpense(saved.id);
          onChanged();
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409 && isEdit) {
          setConflict(true);
          setFormError(err.message);
          return;
        }
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(err.fieldErrors)) mapped[field] = messages[0];
        setFieldErrors(mapped);
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    setSaving(true);
    try {
      await deleteExpense(expenseId);
      onChanged();
      setSaving(false);
      requestClose();
      showToast({
        message: 'Expense deleted',
        actionLabel: 'Undo',
        onAction: async () => {
          await restoreExpense(expenseId);
          onChanged();
        },
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not delete');
      setSaving(false);
    }
  }

  async function reloadLatest() {
    try {
      fillFrom(await getExpense(expenseId));
      setFormError(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not reload');
    }
  }

  const canSave = !saving && !loadingExisting && parsedAmount.ok && category !== null && Boolean(paidByEmail);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !dirty) requestClose();
      }}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => !dirty && requestClose()}
        className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative flex max-h-[94dvh] w-full max-w-[480px] flex-col rounded-t-[28px] border-t border-white/10 bg-[#0b1118] shadow-2xl shadow-black transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/15" />
        <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-3">
          <p id={titleId} className="text-lg font-bold text-white">
            {isEdit ? 'Edit expense' : 'Add expense'}
          </p>
          <button type="button" onClick={requestClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full bg-white/[0.06] text-white/70">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
          {loadingExisting ? (
            <p className="py-16 text-center text-sm text-[var(--flat-text-ghost)]">Loading…</p>
          ) : (
            <div className="space-y-5">
              {/* Amount — the one thing you always type. */}
              <div className="pt-2 text-center">
                {/* Tapping the amount brings the keypad back. No text input here,
                    so the phone keyboard never opens for it. */}
                <button
                  type="button"
                  onClick={() => setKeypadOpen(true)}
                  aria-label={`Amount in Canadian dollars: ${amountText ? '$' + formatKeypadAmount(amountText) : 'not entered'}`}
                  aria-expanded={keypadOpen}
                  data-amount={amountText}
                  className="inline-flex max-w-full items-center justify-center gap-1 rounded-2xl px-2"
                >
                  <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }} className={amountText ? 'text-white' : 'text-white/25'}>
                    $
                  </span>
                  <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }} className={`truncate ${amountText ? 'text-white' : 'text-white/25'}`}>
                    {amountText ? formatKeypadAmount(amountText) : '0.00'}
                  </span>
                  {keypadOpen ? <span aria-hidden className="amount-caret ml-0.5 h-10 w-[3px] rounded-full bg-[var(--neon-cyan)]" /> : null}
                </button>
                <p className="mt-1.5 text-xs text-[var(--flat-text-faint)]">CAD · total paid, tax included</p>
                {fieldErrors.amountCents ? <FieldError message={fieldErrors.amountCents} center /> : null}
              </div>

              {duplicate ? (
                <div className="flex gap-2.5 rounded-2xl border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.08)] px-3.5 py-2.5">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--neon-orange)]" />
                  <p className="text-xs leading-relaxed text-[var(--flat-text-dim)]">
                    <span className="font-bold text-white">Possible duplicate:</span> {formatCents(duplicate.amountCents)} {CATEGORY_META[duplicate.category].short},{' '}
                    {friendlyDate(duplicate.expenseDate, today).toLowerCase().replace(/^([a-z]{3} )/, (m) => m.charAt(0).toUpperCase() + m.slice(1))}
                    {duplicate.booking ? ` · ${duplicate.booking.title}` : ''}, added by{' '}
                    {duplicate.createdByEmail === me ? 'you' : partnerLabel(partnerOptions.find((p) => p.email === duplicate.createdByEmail) ?? { email: duplicate.createdByEmail, name: null })}.
                  </p>
                </div>
              ) : null}

              <Section label="Category" error={fieldErrors.category}>
                <div className="grid grid-cols-4 gap-2">
                  {EXPENSE_CATEGORIES.map((c) => {
                    const meta = CATEGORY_META[c];
                    const Icon = meta.icon;
                    const selected = category === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setCategory(c);
                          setFieldErrors((f) => ({ ...f, category: '' }));
                          setKeypadOpen(false);
                          touch();
                        }}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl border py-2.5 transition ${
                          selected ? 'border-white/40 bg-white/[0.1]' : 'border-transparent bg-white/[0.03]'
                        }`}
                      >
                        <span className="flex size-9 items-center justify-center rounded-full" style={{ backgroundColor: colorAlpha(meta.color, 18) }}>
                          <Icon size={17} style={{ color: meta.color }} />
                        </span>
                        <span className={`text-[10.5px] font-bold leading-tight ${selected ? 'text-white' : 'text-[var(--flat-text-dim)]'}`}>{meta.short}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section label="Event" error={fieldErrors.bookingId}>
                <div className="relative">
                  <select
                    value={bookingId ?? ''}
                    onChange={(e) => {
                      setBookingId(e.target.value ? Number(e.target.value) : null);
                      touch();
                    }}
                    className="w-full appearance-none rounded-2xl border border-[var(--flat-border)] bg-white/[0.04] py-3 pl-3.5 pr-9 text-sm text-white outline-none"
                  >
                    <option value="">General business expense</option>
                    {bookingId !== null && !eventOptions.some((b) => b.id === bookingId) ? <option value={bookingId}>Event #{bookingId}</option> : null}
                    {eventOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.eventTitle || 'Untitled event'}
                        {b.eventDate ? ` · ${friendlyDate(b.eventDate, today)}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40" />
                </div>
              </Section>

              <Section label="Paid by" error={fieldErrors.paidByEmail}>
                <div className="flex flex-wrap gap-2">
                  {partnerOptions.map((p) => {
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
                        className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition ${
                          selected ? 'border-white/40 bg-white/[0.1] text-white' : 'border-[var(--flat-border)] text-[var(--flat-text-dim)]'
                        }`}
                      >
                        <span className="flex size-7 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-bold text-white">{initials(p)}</span>
                        <span className="text-xs font-bold">
                          {partnerLabel(p)}
                          {p.email === me ? <span className="font-normal text-[var(--flat-text-faint)]"> (you)</span> : null}
                        </span>
                      </button>
                    );
                  })}
                  {partnerOptions.length === 0 ? <p className="text-xs text-[var(--flat-text-ghost)]">Loading partners…</p> : null}
                </div>
              </Section>

              <Section label="Paid with">
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_ORDER.map((m) => {
                    const Icon = PAYMENT_ICONS[m];
                    const selected = paymentMethod === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setPaymentMethod(m);
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
                {paymentMethod === 'cash' || paymentMethod === 'etransfer' ? (
                  <div className="mt-2 flex items-center justify-between rounded-2xl bg-white/[0.03] px-3 py-2">
                    <span className="text-xs text-[var(--flat-text-faint)]">Whose money?</span>
                    <div className="flex gap-1 rounded-full bg-white/[0.05] p-0.5">
                      {(['personal', 'company'] as FundingSource[]).map((s) => (
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
                <p className="mt-1.5 text-[11px] text-[var(--flat-text-faint)]">
                  {fundingSource === 'company'
                    ? 'Company money — no reimbursement needed.'
                    : reimbursable
                      ? `${partnerLabel(partnerOptions.find((p) => p.email === paidByEmail) ?? { email: paidByEmail || 'partner@', name: null })} will be owed this back.`
                      : 'Paid personally — no reimbursement needed.'}
                </p>
              </Section>

              <div className="grid grid-cols-2 gap-2">
                <DateChip
                  value={expenseDate}
                  label={friendlyDate(expenseDate, today)}
                  min="2025-01-01"
                  max={today}
                  onChange={(v) => {
                    setExpenseDate(v);
                    touch();
                  }}
                  ariaLabel="Date of the expense"
                  className="rounded-2xl border border-[var(--flat-border)] bg-white/[0.03] px-3 py-3"
                />
                <ReceiptPicker receipt={receipt} onPick={handleReceipt} onRemove={() => {
                    setReceipt({ status: 'none' });
                    touch();
                  }} />
              </div>
              {fieldErrors.expenseDate ? <FieldError message={fieldErrors.expenseDate} /> : null}
              {fieldErrors.receipt || fieldErrors.receiptAttachmentId ? <FieldError message={fieldErrors.receipt || fieldErrors.receiptAttachmentId} /> : null}
              {receipt.status === 'ready' && receipt.duplicateOfExpenseId && receipt.duplicateOfExpenseId !== expenseId ? (
                <div className="flex gap-2.5 rounded-2xl border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.08)] px-3.5 py-2.5">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--neon-orange)]" />
                  <p className="text-xs text-[var(--flat-text-dim)]">
                    <span className="font-bold text-white">This receipt was already used</span> on another expense. It may already be recorded.
                  </p>
                </div>
              ) : null}

              {showNotes ? (
                <Section label="Note">
                  <textarea
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      touch();
                    }}
                    rows={2}
                    maxLength={1000}
                    placeholder="What was it for?"
                    className="w-full resize-none rounded-2xl border border-[var(--flat-border)] bg-white/[0.04] p-3 text-sm text-white outline-none placeholder:text-[var(--flat-text-faint)]"
                  />
                </Section>
              ) : null}

              {showMore ? (
                <div className="space-y-2 rounded-2xl bg-white/[0.03] p-3">
                  <Toggle
                    label="Receipt shows HST"
                    hint="Record the tax portion of the total"
                    checked={receiptShowsHst}
                    onChange={(v) => {
                      setReceiptShowsHst(v);
                      touch();
                    }}
                  />
                  {receiptShowsHst ? (
                    <div className="flex items-center justify-between gap-3 pl-1">
                      <span className="text-xs text-[var(--flat-text-faint)]">HST included</span>
                      <div className="flex items-center gap-1 rounded-xl border border-[var(--flat-border)] bg-white/[0.04] px-2.5 py-1.5">
                        <span className="text-xs text-white/50">$</span>
                        <input
                          value={taxTouched ? taxText : suggestedTax ? centsToInput(suggestedTax) : ''}
                          onChange={(e) => {
                            setTaxText(e.target.value.replace(/[^\d.,]/g, ''));
                            setTaxTouched(true);
                            touch();
                          }}
                          inputMode="decimal"
                          aria-label="HST amount"
                          className="w-20 bg-transparent text-right text-sm text-white outline-none"
                        />
                      </div>
                    </div>
                  ) : null}
                  {fieldErrors.taxCents ? <FieldError message={fieldErrors.taxCents} /> : null}
                  {fundingSource === 'personal' ? (
                    <Toggle
                      label="No reimbursement needed"
                      hint="The partner isn't asking to be paid back"
                      checked={waiveReimbursement}
                      onChange={(v) => {
                        setWaiveReimbursement(v);
                        touch();
                      }}
                    />
                  ) : null}
                </div>
              ) : null}

              <div className="flex gap-4">
                {!showNotes ? (
                  <button type="button" onClick={() => setShowNotes(true)} className="text-xs font-bold text-[var(--neon-cyan)]">
                    <span className="text-xs font-bold">+ Add note</span>
                  </button>
                ) : null}
                {!showMore ? (
                  <button type="button" onClick={() => setShowMore(true)} className="text-xs font-bold text-[var(--neon-cyan)]">
                    <span className="text-xs font-bold">+ HST &amp; reimbursement</span>
                  </button>
                ) : null}
              </div>

              {isEdit && detail ? (
                <ReimbursementPanel
                  expense={detail}
                  paidByLabel={partnerLabel(partnerOptions.find((p) => p.email === detail.paidByEmail) ?? { email: detail.paidByEmail, name: null })}
                  nameFor={(email) => partnerLabel(partnerOptions.find((p) => p.email === email.toLowerCase()) ?? { email, name: null })}
                  onUpdated={(next) => {
                    setDetail(next);
                    onChanged();
                  }}
                />
              ) : null}

              {formError ? (
                <div className="rounded-2xl border border-[rgba(244,114,182,0.3)] bg-[rgba(244,114,182,0.08)] px-3.5 py-2.5 text-xs text-[var(--neon-pink)]">
                  {formError}
                  {conflict ? (
                    <button type="button" onClick={reloadLatest} className="ml-2 font-bold text-white underline">
                      <span className="text-xs font-bold">Load latest</span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {keypadOpen && !loadingExisting ? (
          <AmountKeypad
            hint={!amountText ? 'Enter the amount' : !parsedAmount.ok ? parsedAmount.error : !category ? 'Next: choose a category' : 'Ready to save'}
            canContinue={parsedAmount.ok}
            onKey={pressKey}
            onContinue={() => setKeypadOpen(false)}
          />
        ) : (
        <div className="shrink-0 border-t border-white/[0.06] bg-[#0b1118] px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-[15px] font-bold text-[#0a0a0a] transition disabled:opacity-35"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            <span className="text-[15px] font-bold">{saving ? 'Saving…' : isEdit ? 'Save changes' : amountCents > 0 ? `Save ${formatCents(amountCents)}` : 'Save expense'}</span>
          </button>
          {isEdit && !loadingExisting ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="mt-2 flex w-full items-center justify-center gap-1.5 py-2 text-xs font-bold text-[var(--neon-pink)] disabled:opacity-40"
            >
              <Trash2 size={14} /> <span className="text-xs font-bold">Delete expense</span>
            </button>
          ) : null}
        </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">{label}</p>
      {children}
      {error ? <FieldError message={error} /> : null}
    </div>
  );
}

function FieldError({ message, center }: { message: string; center?: boolean }) {
  if (!message) return null;
  return <p className={`mt-1.5 text-xs text-[var(--neon-pink)] ${center ? 'text-center' : ''}`}>{message}</p>;
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-3 py-1 text-left">
      <span>
        <span className="block text-xs font-bold text-white">{label}</span>
        <span className="block text-[11px] text-[var(--flat-text-faint)]">{hint}</span>
      </span>
      <span className={`flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition ${checked ? 'bg-white' : 'bg-white/15'}`}>
        <span className={`size-5 rounded-full transition ${checked ? 'translate-x-4 bg-[#0a0a0a]' : 'bg-white/70'}`} />
      </span>
    </button>
  );
}

function ReceiptPicker({ receipt, onPick, onRemove }: { receipt: ReceiptState; onPick: (f: File) => void; onRemove: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasFile = receipt.status === 'working' || receipt.status === 'ready';
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-2.5 rounded-2xl border border-[var(--flat-border)] bg-white/[0.03] px-3 py-3 text-left"
      >
        {hasFile && receipt.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob/API preview, not an optimisable asset
          <img src={receipt.previewUrl} alt="" className="size-5 shrink-0 rounded object-cover" />
        ) : hasFile && receipt.isPdf ? (
          <FileText size={16} className="text-white/60" />
        ) : (
          <Camera size={16} className="text-white/45" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs font-bold text-white">
          {receipt.status === 'working' ? 'Uploading…' : receipt.status === 'ready' ? 'Receipt added' : receipt.status === 'error' ? 'Try again' : 'Receipt'}
        </span>
        {receipt.status === 'working' ? <Loader2 size={14} className="animate-spin text-white/50" /> : null}
      </button>
      {receipt.status === 'ready' || receipt.status === 'error' ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove receipt"
          className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border border-white/10 bg-[#1a232e] text-white/70"
        >
          <X size={12} />
        </button>
      ) : null}
      {receipt.status === 'error' ? <p className="mt-1 text-[11px] text-[var(--neon-pink)]">{receipt.message}</p> : null}
      {/* No `capture` attribute: phones offer Camera *and* Photos/Files. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onPick(file);
        }}
      />
    </div>
  );
}
