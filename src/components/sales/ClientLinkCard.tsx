'use client';

import { useEffect, useState } from 'react';
import { CalendarPlus, CheckCircle2, Copy, ExternalLink, Link2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import { ApiError } from '@/lib/apiClient';
import { createBookingFromQuote, createClientLink, getClientLink, getQuote, revokeClientLink, type ClientLinkState, type ClientResponseDto, type QuoteDto } from '@/lib/quotesApi';
import { documentDate } from '@/lib/sales/format';
import { QUOTE_STATUS_LABELS } from '@/lib/sales/types';
import { buttonClass, Card, Eyebrow, Notice } from './ui';

// "Oct 13, 2026, 3:05 p.m." in Toronto time.
function when(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Toronto' });
}

const SIGNATURE_FONT = "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive";

// Quote Details: the client's secret link (create / copy / open / regenerate
// / revoke) and the client's answer, kept compact.
export default function ClientLinkCard({ quote, onQuoteChange }: { quote: QuoteDto; onQuoteChange: (q: QuoteDto) => void }) {
  const [state, setState] = useState<ClientLinkState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<'revoke' | 'regenerate' | null>(null);

  useEffect(() => {
    getClientLink(quote.id)
      .then(setState)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the client link'));
    // Reload when the quote changes status (e.g. the client answered).
  }, [quote.id, quote.status]);

  async function run(action: () => Promise<ClientLinkState>, refreshQuote = false) {
    setBusy(true);
    setError(null);
    setConfirming(null);
    try {
      setState(await action());
      if (refreshQuote) onQuoteChange(await getQuote(quote.id));
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const url = state?.link?.path ? `${window.location.origin}${state.link.path}` : null;

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked: select the field so it can be copied by hand.
      (document.getElementById('client-link-url') as HTMLInputElement | null)?.select();
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const response = state?.responses[0];
  const canShare = quote.status !== 'cancelled';

  return (
    <Card tone="tray" className="md:p-6">
      <Eyebrow aside={state?.link ? `${state.link.viewCount} view${state.link.viewCount === 1 ? '' : 's'}${state.link.lastViewedAt ? ` · last ${when(state.link.lastViewedAt)}` : ''}` : undefined}>Client link</Eyebrow>
      {error ? (
        <div className="mb-3">
          <Notice>{error}</Notice>
        </div>
      ) : null}

      {!state ? (
        <div className="h-10 animate-pulse rounded-lg bg-[var(--paper)]" aria-busy="true" />
      ) : state.link ? (
        <div className="space-y-2.5">
          {url ? (
            <div className="flex gap-2">
              <label htmlFor="client-link-url" className="sr-only">
                Client link
              </label>
              <input id="client-link-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-full border border-[var(--line)] bg-[var(--paper)] px-4 py-2.5 text-[13px] text-[var(--ink-2)] outline-none focus:border-[var(--accent)]" />
            </div>
          ) : (
            <p className="text-[13px] text-[var(--ink-3)]">This link can’t be shown again. Regenerate it to get a new one to share.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {url ? (
              <>
                <button type="button" onClick={copy} className={buttonClass('primary', 'px-3 py-2 text-[13px]')}>
                  <Copy size={14} /> {copied ? 'Copied' : 'Copy link'}
                </button>
                <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'px-3 py-2 text-[13px]')}>
                  <ExternalLink size={14} /> Open
                </a>
              </>
            ) : null}
            {confirming ? (
              <span className="flex flex-wrap items-center gap-2 text-[13px]">
                <span className="text-[var(--ink-2)]">{confirming === 'revoke' ? 'Stop this link working?' : 'Replace it? The current link will stop working.'}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => (confirming === 'revoke' ? revokeClientLink(quote.id) : createClientLink(quote.id)), confirming === 'regenerate')}
                  className={buttonClass('secondary', 'border-[var(--bad)]/40 px-3 py-2 text-[13px] text-[var(--bad)]')}
                >
                  {confirming === 'revoke' ? 'Revoke' : 'Regenerate'}
                </button>
                <button type="button" onClick={() => setConfirming(null)} className={buttonClass('ghost', 'px-2 py-2 text-[13px]')}>
                  Cancel
                </button>
              </span>
            ) : (
              <>
                <button type="button" disabled={busy || !canShare} onClick={() => setConfirming('regenerate')} className={buttonClass('ghost', 'px-3 py-2 text-[13px]')}>
                  <RefreshCw size={14} /> Regenerate
                </button>
                <button type="button" disabled={busy} onClick={() => setConfirming('revoke')} className={buttonClass('ghost', 'px-3 py-2 text-[13px] text-[var(--bad)]')}>
                  <Trash2 size={14} /> Revoke
                </button>
              </>
            )}
          </div>
          <p className="text-[12px] text-[var(--ink-3)]">
            Created {when(state.link.createdAt)} by {state.link.createdByEmail}. Anyone with the link can view this quote and accept or decline it.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy || !canShare} onClick={() => run(() => createClientLink(quote.id), true)} className={buttonClass('primary', 'px-3 py-2 text-[13px]')}>
            <Link2 size={14} /> {busy ? 'Creating…' : 'Create client link'}
          </button>
          <p className="text-[12px] text-[var(--ink-3)]">
            {canShare ? (quote.status === 'draft' ? 'Lets the client view, accept or decline online. Sharing marks this draft as Sent.' : 'Lets the client view, accept or decline online.') : 'Cancelled quotes can’t be shared.'}
          </p>
        </div>
      )}

      {response ? (
        <div className="mt-4 border-t border-[var(--line-strong)] pt-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--ink-2)]">{response.action === 'accepted' ? 'Client acceptance' : 'Client response'}</p>
          {response.action === 'accepted' ? (
            // Details beside the signature on wider screens, stacked on phones.
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,280px)] sm:items-start">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[14px]">
                <dt className="text-[var(--ink-3)]">Status</dt>
                <dd className="flex items-center gap-1.5 font-medium text-[var(--ok)]">
                  <CheckCircle2 size={15} aria-hidden /> Accepted
                </dd>
                <dt className="text-[var(--ink-3)]">Accepted by</dt>
                <dd className="break-words">{response.customerName || '—'}</dd>
                {response.customerTitle ? (
                  <>
                    <dt className="text-[var(--ink-3)]">Title</dt>
                    <dd className="break-words">{response.customerTitle}</dd>
                  </>
                ) : null}
                <dt className="text-[var(--ink-3)]">Accepted on</dt>
                <dd>{when(response.createdAt)}</dd>
              </dl>
              <Signature response={response} />
              {pdfNote(quote, response) ? <p className="text-[12px] leading-snug text-[var(--ink-3)] sm:col-span-2">{pdfNote(quote, response)}</p> : null}
              {(quote.status === 'accepted' || quote.status === 'converted') && quote.eventId === null ? (
                <div className="sm:col-span-2">
                  <BookingRecovery quote={quote} onQuoteChange={onQuoteChange} />
                </div>
              ) : null}
            </div>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[14px]">
              <dt className="text-[var(--ink-3)]">Status</dt>
              <dd className="flex items-center gap-1.5 font-medium text-[var(--bad)]">
                <XCircle size={15} aria-hidden /> Declined
              </dd>
              <dt className="text-[var(--ink-3)]">Date</dt>
              <dd>{documentDate(response.createdAt)}</dd>
              <dt className="text-[var(--ink-3)]">Reason</dt>
              <dd className="whitespace-pre-line">{response.declineReason || '—'}</dd>
            </dl>
          )}
        </div>
      ) : null}
    </Card>
  );
}

// Why an acceptance isn't printed on the quote PDF, if it isn't. The PDF
// signs only while the quote is still accepted at the total the client
// agreed to (see signedAcceptance in documentModel.ts).
// The client accepted, but no booking is linked — the automatic booking
// didn't happen. Same booking logic as on acceptance, so a repeat is safe.
function BookingRecovery({ quote, onQuoteChange }: { quote: QuoteDto; onQuoteChange: (q: QuoteDto) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      onQuoteChange(await createBookingFromQuote(quote.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The booking couldn’t be created');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--line-strong)] bg-[var(--paper)] px-3 py-2.5">
      <p className="min-w-0 flex-1 text-[13px] text-[var(--ink-2)]">No booking was created for this acceptance.</p>
      <button type="button" onClick={create} disabled={busy} className={buttonClass('primary', 'px-3 py-2 text-[13px]')}>
        <CalendarPlus size={14} /> {busy ? 'Creating…' : 'Create booking'}
      </button>
      {error ? (
        <div className="basis-full">
          <Notice>{error}</Notice>
        </div>
      ) : null}
    </div>
  );
}

function pdfNote(quote: QuoteDto, response: ClientResponseDto): string | null {
  if (quote.status !== 'accepted' && quote.status !== 'converted') {
    return `Not printed on the PDF: the quote was marked ${QUOTE_STATUS_LABELS[quote.status]} after the client accepted. Mark it Accepted to sign the PDF again.`;
  }
  if (quote.totalCents !== response.quoteTotalCents) return 'Not printed on the PDF: the quote’s total has changed since the client accepted it.';
  return null;
}

// The client's signature as signed: a drawn one as its image (a 600×200
// transparent PNG, scaled down with its proportions kept), a typed one in a
// script face and labelled as typed. Missing or unreadable data gets a quiet
// note instead of a broken image.
function Signature({ response }: { response: ClientResponseDto }) {
  const data = response.signatureData?.trim() ?? '';
  const drawn = response.signatureType === 'drawn' && data.startsWith('data:image/png;base64,');
  const typed = response.signatureType === 'typed' && data.length > 0;
  return (
    <figure className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 pb-2 pt-2.5">
      <div className="flex min-h-14 items-end border-b border-[var(--line-strong)] pb-1">
        {drawn ? (
          // eslint-disable-next-line @next/next/no-img-element -- a stored PNG data URL (validated on save)
          <img src={data} alt={`Signature of ${response.customerName ?? 'the client'}`} width={600} height={200} className="h-16 w-auto max-w-full object-contain object-left" />
        ) : typed ? (
          <p className="min-w-0 break-words text-[24px] italic leading-tight text-[var(--ink)]" style={{ fontFamily: SIGNATURE_FONT }}>
            {data}
          </p>
        ) : (
          <p className="text-[13px] text-[var(--ink-3)]">Signature not available</p>
        )}
      </div>
      <figcaption className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)]">{drawn ? 'Drawn signature' : typed ? 'Typed signature' : 'Signature'}</figcaption>
    </figure>
  );
}
