// Keeps the quote builder's unsaved work on this device, so closing the tab,
// tapping Back or losing the page by mistake doesn't lose a half-written
// quote. One slot for a new quote, one per quote being edited. Storage can be
// unavailable (private browsing, blocked site data) — every access is
// wrapped, and the builder works the same without it, just without recovery.
import { newKey, type QuoteDraft } from './quoteDraft';

const PREFIX = 'harmony.quoteDraft.v1:';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type DraftSlot = { mode: 'create' } | { mode: 'edit'; quoteId: string };

export interface StoredQuoteDraft {
  draft: QuoteDraft;
  // create: the id the save will use, so a recovered draft is still saved once.
  newId?: string;
  // edit: the quote version the changes were made on, so a save after
  // someone else's edit still reports the conflict.
  version?: string;
  savedAt: number;
}

const keyFor = (slot: DraftSlot) => PREFIX + (slot.mode === 'create' ? 'new' : `edit:${slot.quoteId}`);

// Item and section keys only need to be unique on this page; the counter
// restarts on reload, so recovered ones are given fresh keys.
function rekey(d: QuoteDraft): QuoteDraft {
  return { ...d, sections: d.sections.map((s) => ({ ...s, key: newKey(), items: s.items.map((i) => ({ ...i, key: newKey() })) })) };
}

export function readStoredDraft(slot: DraftSlot): StoredQuoteDraft | null {
  try {
    const raw = window.localStorage.getItem(keyFor(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredQuoteDraft;
    const ok = parsed && typeof parsed.savedAt === 'number' && parsed.draft && Array.isArray(parsed.draft.sections) && parsed.draft.sections.every((s) => Array.isArray(s.items));
    if (!ok || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      clearStoredDraft(slot);
      return null;
    }
    return { ...parsed, draft: rekey(parsed.draft) };
  } catch {
    return null;
  }
}

export function writeStoredDraft(slot: DraftSlot, value: Omit<StoredQuoteDraft, 'savedAt'>): void {
  try {
    window.localStorage.setItem(keyFor(slot), JSON.stringify({ ...value, savedAt: Date.now() }));
  } catch {
    // Not critical — the quote just isn't recoverable if the page is lost.
  }
}

export function clearStoredDraft(slot: DraftSlot): void {
  try {
    window.localStorage.removeItem(keyFor(slot));
  } catch {
    // Nothing to clear.
  }
}
