'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, PenLine, Type, X } from 'lucide-react';
import SignaturePad from './SignaturePad';

type Mode = 'idle' | 'accept' | 'decline';
type SignatureMode = 'typed' | 'drawn';

const field = 'w-full rounded-lg border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-2.5 text-[16px] text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] aria-[invalid=true]:border-[var(--bad)]';
// Harmony orange with charcoal text (white on orange isn't readable enough).
// Harmony Ops pill buttons (bold, press in slightly).
const pill = 'inline-flex touch-manipulation select-none items-center justify-center gap-2 rounded-full px-6 py-3 transition-[transform,background-color,filter] duration-75 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:pointer-events-none disabled:opacity-50';
const primary = `${pill} bg-[var(--accent)] text-[16px] font-bold text-[var(--ink)] hover:brightness-95`;
const quiet = `${pill} border border-[var(--line-strong)] bg-[var(--paper)] text-[15px] font-semibold text-[var(--ink-2)] hover:bg-[var(--paper-sunk)]`;

interface ApiFailure {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// Accept / Decline for an open quote. The quote is identified only by the
// link's token (in the URL); `version` is the quote as the client sees it,
// so an answer to an out-of-date quote is refused.
export default function ClientQuoteActions({ token, version }: { token: string; version: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('idle');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('typed');
  const [typedSignature, setTypedSignature] = useState('');
  const [drawnSignature, setDrawnSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const ids = useId();
  const sent = useRef(false);

  // Report that the client opened the quote (once per page load).
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void fetch(`/api/public/quotes/${encodeURIComponent(token)}/view`, { method: 'POST' }).catch(() => {});
  }, [token]);

  function open(next: Mode) {
    setMode(next);
    setErrors({});
    setFormError(null);
  }

  async function send(path: 'accept' | 'decline', body: unknown) {
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/public/quotes/${encodeURIComponent(token)}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        // The page re-renders from the server with the answer recorded.
        router.refresh();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const data: ApiFailure = await res.json().catch(() => ({}));
      const fieldErrors: Record<string, string> = {};
      for (const [k, v] of Object.entries(data.fieldErrors ?? {})) if (v?.[0]) fieldErrors[k.split('.')[0]] = v[0];
      setErrors(fieldErrors);
      setFormError(data.error ?? 'Something went wrong. Please try again.');
      setStale(res.status === 409 && /updated since you opened it/.test(data.error ?? ''));
    } catch {
      setFormError('No connection. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  }

  function submitAccept(e: React.FormEvent) {
    e.preventDefault();
    // Quick checks here for instant feedback; the server checks everything again.
    const next: Record<string, string> = {};
    if (!name.trim()) next.customerName = 'Enter your full name';
    const signature = signatureMode === 'typed' ? typedSignature.trim() : drawnSignature;
    if (!signature) next.signature = signatureMode === 'typed' ? 'Type your name as your signature' : 'Draw your signature';
    if (!agreed) next.acceptedTerms = 'Tick the box to accept the quote and its terms';
    setErrors(next);
    if (Object.keys(next).length) {
      setFormError('Please complete the highlighted fields.');
      return;
    }
    void send('accept', {
      version,
      customerName: name,
      customerTitle: title || null,
      acceptedTerms: true,
      signature: { type: signatureMode, value: signature },
    });
  }

  function submitDecline(e: React.FormEvent) {
    e.preventDefault();
    void send('decline', { version, reason: reason || null });
  }

  const error = (key: string) =>
    errors[key] ? (
      <p id={`${ids}-${key}-error`} className="mt-1 text-[13px] text-[var(--bad)]">
        {errors[key]}
      </p>
    ) : null;

  return (
    <section aria-labelledby={`${ids}-heading`} className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-5 md:p-6">
      <h2 id={`${ids}-heading`} className="text-[18px] font-semibold">
        {mode === 'decline' ? 'Decline this quote' : 'Ready to go ahead?'}
      </h2>

      {formError ? (
        <div role="alert" className="mt-3 rounded-lg border border-[var(--bad)]/25 bg-[var(--bad-soft)] px-3 py-2.5 text-[14px] text-[var(--bad)]">
          <p>{formError}</p>
          {stale ? (
            <button type="button" onClick={() => window.location.reload()} className="mt-1 font-semibold underline">
              Reload the latest version
            </button>
          ) : null}
        </div>
      ) : null}

      {mode === 'idle' ? (
        <>
          <p className="mt-1 text-[15px] text-[var(--ink-2)]">Review the quote above, then accept it to confirm your booking request — or let us know if it isn’t right for you.</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" className={`${primary} sm:min-w-[200px]`} onClick={() => open('accept')}>
              <Check size={18} /> Accept quote
            </button>
            <button type="button" className={quiet} onClick={() => open('decline')}>
              Decline quote
            </button>
          </div>
        </>
      ) : null}

      {mode === 'accept' ? (
        <form onSubmit={submitAccept} noValidate className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${ids}-name`} className="mb-1 block text-[14px] font-medium">
                Full name
              </label>
              <input
                id={`${ids}-name`}
                className={field}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                aria-invalid={!!errors.customerName}
                aria-describedby={errors.customerName ? `${ids}-customerName-error` : undefined}
              />
              {error('customerName')}
            </div>
            <div>
              <label htmlFor={`${ids}-title`} className="mb-1 block text-[14px] font-medium">
                Title / role <span className="font-normal text-[var(--ink-3)]">(optional)</span>
              </label>
              <input id={`${ids}-title`} className={field} value={title} onChange={(e) => setTitle(e.target.value)} autoComplete="organization-title" />
            </div>
          </div>

          <fieldset>
            <legend id={`${ids}-sig-label`} className="mb-1.5 text-[14px] font-medium">
              Signature
            </legend>
            <div role="radiogroup" aria-label="How to sign" className="mb-2 inline-flex rounded-lg border border-[var(--line-strong)] p-0.5">
              {(
                [
                  ['typed', 'Type', Type],
                  ['drawn', 'Draw', PenLine],
                ] as const
              ).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={signatureMode === value}
                  onClick={() => setSignatureMode(value)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[14px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)] ${signatureMode === value ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink-2)]'}`}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            {signatureMode === 'typed' ? (
              <div>
                <label htmlFor={`${ids}-typed`} className="sr-only">
                  Type your full name as your signature
                </label>
                <input
                  id={`${ids}-typed`}
                  className={field}
                  placeholder="Type your full name"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  aria-invalid={!!errors.signature}
                  aria-describedby={errors.signature ? `${ids}-signature-error` : undefined}
                />
                {typedSignature.trim() ? (
                  <p aria-hidden className="mt-2 border-b border-[var(--line-strong)] px-1 pb-1 font-[cursive] text-[28px] italic leading-tight text-[var(--ink)]" style={{ fontFamily: "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive" }}>
                    {typedSignature}
                  </p>
                ) : null}
              </div>
            ) : (
              <SignaturePad onChange={setDrawnSignature} labelledBy={`${ids}-sig-label`} />
            )}
            {error('signature')}
          </fieldset>

          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--paper-sunk)] px-3 py-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
                aria-invalid={!!errors.acceptedTerms}
                aria-describedby={errors.acceptedTerms ? `${ids}-acceptedTerms-error` : undefined}
              />
              <span className="text-[14px] leading-snug">
                I accept this quote, its pricing, and the Terms &amp; Conditions. By accepting, I confirm that I have reviewed and agree to the pricing, scope of work, and Terms &amp; Conditions shown above.
              </span>
            </label>
            {error('acceptedTerms')}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className={`${primary} sm:min-w-[200px]`} disabled={busy}>
              <Check size={18} /> {busy ? 'Accepting…' : 'Accept quote'}
            </button>
            <button type="button" className={quiet} onClick={() => open('idle')} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {mode === 'decline' ? (
        <form onSubmit={submitDecline} className="mt-3 space-y-4">
          <div>
            <label htmlFor={`${ids}-reason`} className="mb-1 block text-[14px] font-medium">
              Reason for declining <span className="font-normal text-[var(--ink-3)]">(optional)</span>
            </label>
            <textarea id={`${ids}-reason`} rows={3} maxLength={1000} className={`${field} resize-y`} value={reason} onChange={(e) => setReason(e.target.value)} />
            {error('reason')}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className={`${quiet} border-[var(--bad)]/40 text-[var(--bad)]`} disabled={busy}>
              <X size={16} /> {busy ? 'Declining…' : 'Decline quote'}
            </button>
            <button type="button" className={quiet} onClick={() => open('idle')} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
