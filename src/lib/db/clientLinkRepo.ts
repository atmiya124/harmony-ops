// Client quote links and the client's response (Phase 3). The public side
// only ever reaches a quote through a link's token: the token is hashed and
// looked up, and the quote is loaded from that link on the server. Nothing
// a client sends can point at another quote.
import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from './client';
import { quoteAcceptances, quoteAccessLinks, quoteActivity, quotes, salesAuditLog, type QuoteAccessLinkRow, type QuoteRow } from './schema';
import { FinanceError, nextTimestamp, nowIso, type Actor, type Tx } from './financeRepo';
import { getQuote } from './quoteRepo';
import { CLIENT_QUOTE_PATH, decryptLinkToken, encryptLinkToken, generateLinkToken, hashLinkToken, isWellFormedToken } from '../sales/clientLinkToken';
import { toPublicQuote, type PublicQuote, type PublicQuoteResponse } from '../sales/publicQuote';
import type { QuoteActivityEvent, QuoteResponseAction, QuoteStatus, SignatureType } from '../sales/types';
import type { QuoteAcceptInput, QuoteDeclineInput } from '../schemas/clientQuote';

type Reader = Tx | typeof db;

// Who did it, for quote_activity / sales_audit_log. A client has no user
// account, so client actions are recorded with the fixed id "client".
type By = { type: 'staff'; actor: Actor } | { type: 'client' };
const CLIENT_ACTOR = 'client';

// Statuses a client can answer from. Draft quotes aren't shared yet;
// accepted/declined/expired/cancelled/converted ones are settled.
const OPEN_STATUSES: QuoteStatus[] = ['sent', 'viewed'];

// What the client's browser sent along with an answer (stored for the
// record only; never shown publicly, never used to decide anything).
export interface RequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

// ---------------------------------------------------------------------------
// DTOs (staff side)
// ---------------------------------------------------------------------------

export interface StaffClientLinkDto {
  path: string | null; // "/q/<token>"; null if the token can't be decrypted any more
  createdAt: string;
  createdByEmail: string;
  expiresAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
}

export interface ClientResponseDto {
  action: QuoteResponseAction;
  quoteTotalCents: number; // the quote total the client answered
  customerName: string | null;
  customerTitle: string | null;
  signatureType: SignatureType | null;
  signatureData: string | null;
  declineReason: string | null;
  createdAt: string;
}

export interface DocumentAcceptance {
  customerName: string | null;
  customerTitle: string | null;
  signatureType: SignatureType | null;
  signatureData: string | null;
  quoteTotalCents: number; // the total the client accepted
  acceptedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function logActivity(tx: Tx, quoteId: string, event: QuoteActivityEvent, by: By, at: string, linkId: string | null, metadata?: Record<string, unknown>) {
  await tx.insert(quoteActivity).values({
    quoteId,
    event,
    actorType: by.type,
    actorEmail: by.type === 'staff' ? by.actor.email : null,
    accessLinkId: linkId,
    metadata: metadata ? JSON.stringify(metadata) : null,
    createdAt: at,
  });
}

// Status changes also go to the quote's main history (sales_audit_log).
async function auditStatus(tx: Tx, before: QuoteRow, after: QuoteRow, by: By, at: string) {
  await tx.insert(salesAuditLog).values({
    entityType: 'quote',
    entityId: before.id,
    action: 'status',
    changedByUserId: by.type === 'staff' ? by.actor.id : CLIENT_ACTOR,
    changedByEmail: by.type === 'staff' ? by.actor.email : CLIENT_ACTOR,
    changedAt: at,
    before: JSON.stringify(before),
    after: JSON.stringify(after),
  });
}

function isLive(link: QuoteAccessLinkRow, now: string): boolean {
  return !link.revokedAt && (!link.expiresAt || link.expiresAt > now);
}

// The link and its quote for a token, or null for anything that isn't a
// live link to an existing quote: malformed, unknown, revoked or expired
// tokens all look the same to the caller.
async function resolveToken(reader: Reader, token: string): Promise<{ link: QuoteAccessLinkRow; quote: QuoteRow } | null> {
  if (!isWellFormedToken(token)) return null;
  const [link] = await reader.select().from(quoteAccessLinks).where(eq(quoteAccessLinks.tokenHash, hashLinkToken(token)));
  if (!link || !isLive(link, nowIso())) return null;
  const [quote] = await reader.select().from(quotes).where(and(eq(quotes.id, link.quoteId), isNull(quotes.deletedAt)));
  return quote ? { link, quote } : null;
}

const notFound = () => new FinanceError(404, 'This quote link isn’t valid. Please contact Harmony Production for a new link.');

async function latestResponse(reader: Reader, quoteId: string): Promise<PublicQuoteResponse | null> {
  const [r] = await reader
    .select()
    .from(quoteAcceptances)
    .where(eq(quoteAcceptances.quoteId, quoteId))
    .orderBy(desc(quoteAcceptances.createdAt))
    .limit(1);
  return r ? { action: r.action, name: r.customerName, title: r.customerTitle, at: r.createdAt } : null;
}

// ---------------------------------------------------------------------------
// Staff: create / revoke / show the link
// ---------------------------------------------------------------------------

// A new link for the quote; any live link is revoked first (so this is also
// "regenerate"). Sharing a draft marks it Sent. Returns the link's path —
// the only time the token leaves the server besides getStaffClientLink.
export async function createClientLink(quoteId: string, actor: Actor): Promise<StaffClientLinkDto> {
  return db.transaction(async (tx) => {
    const [quote] = await tx.select().from(quotes).where(and(eq(quotes.id, quoteId), isNull(quotes.deletedAt)));
    if (!quote) throw new FinanceError(404, 'Quote not found');
    if (quote.status === 'cancelled') throw new FinanceError(409, 'Cancelled quotes can’t be shared.');

    const at = nowIso();
    const by: By = { type: 'staff', actor };
    const live = (await tx.select().from(quoteAccessLinks).where(and(eq(quoteAccessLinks.quoteId, quoteId), isNull(quoteAccessLinks.revokedAt)))).filter((l) => isLive(l, at));
    if (live.length) {
      await tx
        .update(quoteAccessLinks)
        .set({ revokedAt: at, revokedByEmail: actor.email })
        .where(inArray(quoteAccessLinks.id, live.map((l) => l.id)));
      for (const l of live) await logActivity(tx, quoteId, 'client_link_revoked', by, at, l.id, { reason: 'replaced' });
    }

    const token = generateLinkToken();
    const id = randomUUID();
    const [link] = await tx
      .insert(quoteAccessLinks)
      .values({ id, quoteId, tokenHash: hashLinkToken(token), tokenEncrypted: encryptLinkToken(token), createdByUserId: actor.id, createdByEmail: actor.email, createdAt: at })
      .returning();
    await logActivity(tx, quoteId, 'client_link_created', by, at, id);

    // Sharing a draft sends it.
    if (quote.status === 'draft') {
      const changedAt = nextTimestamp(quote.updatedAt);
      const [after] = await tx
        .update(quotes)
        .set({ status: 'sent', statusChangedAt: changedAt, sentAt: quote.sentAt ?? changedAt, updatedByEmail: actor.email, updatedAt: changedAt })
        .where(eq(quotes.id, quoteId))
        .returning();
      await auditStatus(tx, quote, after, by, changedAt);
    }
    return toStaffLink(link, token);
  });
}

export async function revokeClientLink(quoteId: string, actor: Actor): Promise<void> {
  await db.transaction(async (tx) => {
    const at = nowIso();
    const live = (await tx.select().from(quoteAccessLinks).where(and(eq(quoteAccessLinks.quoteId, quoteId), isNull(quoteAccessLinks.revokedAt)))).filter((l) => isLive(l, at));
    if (!live.length) return;
    await tx
      .update(quoteAccessLinks)
      .set({ revokedAt: at, revokedByEmail: actor.email })
      .where(inArray(quoteAccessLinks.id, live.map((l) => l.id)));
    for (const l of live) await logActivity(tx, quoteId, 'client_link_revoked', { type: 'staff', actor }, at, l.id, { reason: 'revoked' });
  });
}

function toStaffLink(link: QuoteAccessLinkRow, token: string | null): StaffClientLinkDto {
  return {
    path: token ? `${CLIENT_QUOTE_PATH}${token}` : null,
    createdAt: link.createdAt,
    createdByEmail: link.createdByEmail,
    expiresAt: link.expiresAt,
    viewCount: link.viewCount,
    lastViewedAt: link.lastViewedAt,
  };
}

// The quote's live link (if any) and the client's responses, newest first.
export async function getStaffClientLink(quoteId: string): Promise<{ link: StaffClientLinkDto | null; responses: ClientResponseDto[] }> {
  const at = nowIso();
  const [links, responses] = await Promise.all([
    db.select().from(quoteAccessLinks).where(and(eq(quoteAccessLinks.quoteId, quoteId), isNull(quoteAccessLinks.revokedAt))).orderBy(desc(quoteAccessLinks.createdAt)),
    db.select().from(quoteAcceptances).where(eq(quoteAcceptances.quoteId, quoteId)).orderBy(desc(quoteAcceptances.createdAt)),
  ]);
  const live = links.find((l) => isLive(l, at));
  return {
    link: live ? toStaffLink(live, live.tokenEncrypted ? decryptLinkToken(live.tokenEncrypted) : null) : null,
    responses: responses.map((r) => ({
      action: r.action,
      quoteTotalCents: r.quoteTotalCents,
      customerName: r.customerName,
      customerTitle: r.customerTitle,
      signatureType: r.signatureType,
      signatureData: r.signatureData,
      declineReason: r.declineReason,
      createdAt: r.createdAt,
    })),
  };
}

// ---------------------------------------------------------------------------
// Client (public): view, accept, decline
// ---------------------------------------------------------------------------

// The quote as the client sees it, or null for an invalid/revoked link.
// `today` is the Toronto date (YYYY-MM-DD) validity is judged against.
export async function getPublicQuote(token: string, today: string): Promise<PublicQuote | null> {
  const found = await resolveToken(db, token);
  if (!found) return null;
  const quote = await getQuote(found.quote.id);
  if (!quote) return null;
  return toPublicQuote(quote, await latestResponse(db, quote.id), today);
}

// Counts a client opening the link; the first one marks a Sent quote as
// Viewed. Doesn't change the quote's version, so a page that's already open
// can still be accepted.
export async function recordClientView(token: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const found = await resolveToken(tx, token);
    if (!found) return false;
    const at = nowIso();
    await tx
      .update(quoteAccessLinks)
      .set({ viewCount: sql`${quoteAccessLinks.viewCount} + 1`, lastViewedAt: at })
      .where(eq(quoteAccessLinks.id, found.link.id));
    await logActivity(tx, found.quote.id, 'quote_viewed', { type: 'client' }, at, found.link.id);
    if (found.quote.status === 'sent') {
      const [after] = await tx
        .update(quotes)
        .set({ status: 'viewed', statusChangedAt: at })
        .where(and(eq(quotes.id, found.quote.id), eq(quotes.status, 'sent')))
        .returning();
      if (after) await auditStatus(tx, found.quote, after, { type: 'client' }, at);
    }
    return true;
  });
}

// Why a quote can't be answered right now, in words for the client.
function assertAnswerable(quote: QuoteRow, version: string, today: string) {
  if (quote.status === 'accepted' || quote.status === 'converted') throw new FinanceError(409, 'This quote has already been accepted.');
  if (quote.status === 'declined') throw new FinanceError(409, 'This quote has already been declined.');
  if (!OPEN_STATUSES.includes(quote.status)) throw new FinanceError(409, 'This quote isn’t open for a response. Please contact Harmony Production.');
  if (quote.validUntil < today) throw new FinanceError(409, 'This quote has expired. Please contact Harmony Production for an updated quote.');
  if (quote.updatedAt !== version) throw new FinanceError(409, 'This quote was updated since you opened it. Please review the latest version.');
}

async function respond(
  token: string,
  action: QuoteResponseAction,
  version: string,
  today: string,
  meta: RequestMeta,
  record: Omit<typeof quoteAcceptances.$inferInsert, 'id' | 'quoteId' | 'accessLinkId' | 'action' | 'quoteTotalCents' | 'quoteVersion' | 'ipAddress' | 'userAgent' | 'createdAt'>,
): Promise<PublicQuote> {
  await db.transaction(async (tx) => {
    const found = await resolveToken(tx, token);
    if (!found) throw notFound();
    const { quote, link } = found;
    assertAnswerable(quote, version, today);

    const at = nextTimestamp(quote.updatedAt);
    const status: QuoteStatus = action === 'accepted' ? 'accepted' : 'declined';
    // Only from the exact version and an open status: a second click, or two
    // answers racing, can't both get through.
    const [after] = await tx
      .update(quotes)
      .set({
        status,
        statusChangedAt: at,
        acceptedAt: action === 'accepted' ? (quote.acceptedAt ?? at) : quote.acceptedAt,
        updatedByEmail: CLIENT_ACTOR,
        updatedAt: at,
      })
      .where(and(eq(quotes.id, quote.id), eq(quotes.updatedAt, version), inArray(quotes.status, OPEN_STATUSES)))
      .returning();
    if (!after) throw new FinanceError(409, 'This quote has already been answered or changed. Please reload the page.');

    await tx.insert(quoteAcceptances).values({
      id: randomUUID(),
      quoteId: quote.id,
      accessLinkId: link.id,
      action,
      ...record,
      quoteTotalCents: quote.totalCents,
      quoteVersion: version,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      createdAt: at,
    });
    await logActivity(tx, quote.id, action === 'accepted' ? 'quote_accepted' : 'quote_declined', { type: 'client' }, at, link.id);
    await auditStatus(tx, quote, after, { type: 'client' }, at);
  });
  return (await getPublicQuote(token, today))!;
}

export function acceptQuoteByLink(token: string, input: QuoteAcceptInput, meta: RequestMeta, today: string): Promise<PublicQuote> {
  return respond(token, 'accepted', input.version, today, meta, {
    customerName: input.customerName,
    customerTitle: input.customerTitle,
    signatureType: input.signature.type,
    signatureData: input.signature.value,
    acceptedTerms: true,
  });
}

export function declineQuoteByLink(token: string, input: QuoteDeclineInput, meta: RequestMeta, today: string): Promise<PublicQuote> {
  return respond(token, 'declined', input.version, today, meta, { declineReason: input.reason });
}

// The client's acceptance, for printing on the quote PDF: only when their
// latest answer was to accept. Just what the document shows — no IP,
// browser, link or audit details.
export async function getAcceptanceForDocument(quoteId: string): Promise<DocumentAcceptance | null> {
  const [r] = await db
    .select()
    .from(quoteAcceptances)
    .where(eq(quoteAcceptances.quoteId, quoteId))
    .orderBy(desc(quoteAcceptances.createdAt))
    .limit(1);
  if (!r || r.action !== 'accepted') return null;
  return {
    customerName: r.customerName,
    customerTitle: r.customerTitle,
    signatureType: r.signatureType,
    signatureData: r.signatureData,
    quoteTotalCents: r.quoteTotalCents,
    acceptedAt: r.createdAt,
  };
}

// The quote id behind a live link (for the public PDF download).
export async function quoteIdForToken(token: string): Promise<string | null> {
  return (await resolveToken(db, token))?.quote.id ?? null;
}
