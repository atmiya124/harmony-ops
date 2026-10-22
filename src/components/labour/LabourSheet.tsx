'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Plus, Search, UserPlus, X } from 'lucide-react';
import BottomSheet, { SheetButton, SheetError } from '@/components/ui/BottomSheet';
import {
  ApiError,
  createCrewMember,
  CREW_KEY,
  getEventLabour,
  listCrew,
  saveEventLabour,
  type CrewMemberDto,
  type EventLabourDto,
  type LabourLineFormValues,
} from '@/lib/financeApi';
import { BOOKINGS_KEY } from '@/lib/bookingsApi';
import { loadCached, peekCache } from '@/lib/clientCache';
import type { Booking } from '@/lib/bookingTypes';
import { centsToInput, formatCents, parseAmountToCents } from '@/lib/money';
import { formatHours, labourSummaryLabel, lineAmountCents, MAX_LABOUR_LINES, parseHours } from '@/lib/finance/labour';

// "Add labour" on an event. It opens on the crew list: tap who worked and
// they're added with their usual rate filled in, ready for the hours. Anyone
// not on the list can be typed in as a one-off (and saved to the crew in
// one tap). No payment details here — those are recorded later, per person.

interface Row {
  id: string; // the line id: kept across edits so payments stay attached
  crewMemberId: string | null; // null = a one-off person
  name: string;
  role: string | null;
  hoursText: string;
  rateText: string;
  paidCents: number;
}

function rowsFrom(labour: EventLabourDto): Row[] {
  return labour.lines.map((l) => ({
    id: l.id,
    crewMemberId: l.crewMemberId,
    name: l.workerName,
    role: l.role,
    hoursText: formatHours(l.minutes),
    rateText: centsToInput(l.rateCents),
    paidCents: l.paidCents,
  }));
}

type Parsed = { ok: true; line: LabourLineFormValues } | { ok: false; error: string };

function parseRow(row: Row): Parsed {
  if (!row.name.trim()) return { ok: false, error: 'Enter a name' };
  const hours = parseHours(row.hoursText);
  if (!hours.ok) return { ok: false, error: hours.error };
  const rate = parseAmountToCents(row.rateText);
  if (!rate.ok) return { ok: false, error: row.rateText.trim() ? rate.error : 'Enter the hourly rate' };
  return { ok: true, line: { id: row.id, crewMemberId: row.crewMemberId, workerName: row.name.trim(), role: row.role, minutes: hours.minutes, rateCents: rate.cents } };
}

// A row nobody has started on is ignored, so a spare blank row never blocks saving.
const isBlank = (row: Row) => !row.name.trim() && !row.hoursText.trim() && !row.rateText.trim();

export default function LabourSheet({
  bookingId,
  onClose,
  onChanged,
  showToast,
}: {
  bookingId: number;
  onClose: () => void;
  onChanged: () => void;
  showToast: (t: { message: string }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<EventLabourDto | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [crew, setCrew] = useState<CrewMemberDto[]>(() => peekCache<CrewMemberDto[]>(CREW_KEY) ?? []);
  const [crewLoaded, setCrewLoaded] = useState(() => peekCache<CrewMemberDto[]>(CREW_KEY) !== undefined);
  const [choosing, setChoosing] = useState(true); // the "Who worked?" list
  const [focus, setFocus] = useState<{ rowId: string; field: 'name' | 'hours' } | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const eventTitle =
    existing?.booking?.title ?? peekCache<Booking[]>(BOOKINGS_KEY)?.find((b) => b.id === bookingId)?.eventTitle ?? `Event #${bookingId}`;

  useEffect(() => {
    getEventLabour(bookingId)
      .then((labour) => {
        setExisting(labour);
        if (labour) {
          setRows(rowsFrom(labour));
          setChoosing(false); // editing: show who's there; Add person reopens the list
        }
      })
      .catch((err) => setFormError(err instanceof Error ? err.message : 'Could not load labour'))
      .finally(() => setLoading(false));
    loadCached(CREW_KEY, listCrew)
      .then(setCrew)
      .catch(() => {})
      .finally(() => setCrewLoaded(true));
  }, [bookingId]);

  const parsed = rows.map((r) => (isBlank(r) ? null : parseRow(r)));
  const lines = parsed.flatMap((p) => (p?.ok ? [p.line] : []));
  const totalCents = lines.reduce((s, l) => s + lineAmountCents(l.minutes, l.rateCents), 0);
  const totalMinutes = lines.reduce((s, l) => s + l.minutes, 0);
  const onSheet = new Set(rows.map((r) => r.crewMemberId).filter(Boolean));
  const available = crew.filter((m) => m.active && !onSheet.has(m.id));

  function touch() {
    setFormError(null);
    setDirty(true);
  }

  function update(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setRowErrors((e) => ({ ...e, [id]: '' }));
    touch();
  }

  // The profile supplies today's defaults; the line keeps its own copy.
  const fromCrew = (m: CrewMemberDto) => ({
    crewMemberId: m.id,
    name: m.name,
    role: m.role,
    rateText: m.defaultRateCents !== null ? centsToInput(m.defaultRateCents) : '',
  });

  function addFromCrew(member: CrewMemberDto) {
    const row: Row = { id: crypto.randomUUID(), hoursText: '', paidCents: 0, ...fromCrew(member) };
    setRows((rs) => [...rs, row]);
    setFocus({ rowId: row.id, field: 'hours' });
    setChoosing(false);
    touch();
  }

  function addOneOff() {
    const row: Row = { id: crypto.randomUUID(), crewMemberId: null, name: '', role: null, hoursText: '', rateText: '', paidCents: 0 };
    setRows((rs) => [...rs, row]);
    setFocus({ rowId: row.id, field: 'name' });
    setChoosing(false);
    touch();
  }

  async function saveToCrew(row: Row) {
    const rate = parseAmountToCents(row.rateText);
    try {
      const member = await createCrewMember(crypto.randomUUID(), {
        name: row.name.trim(),
        phone: null,
        email: null,
        role: null,
        company: null,
        defaultRateCents: rate.ok ? rate.cents : null,
        notes: null,
        active: true,
      });
      setCrew((c) => [...c, member].sort((a, b) => a.name.localeCompare(b.name)));
      update(row.id, { crewMemberId: member.id, name: member.name });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add to crew');
    }
  }

  async function handleSave() {
    const errors: Record<string, string> = {};
    rows.forEach((r, i) => {
      const p = parsed[i];
      if (p && !p.ok) errors[r.id] = p.error;
    });
    setRowErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (lines.length === 0) {
      setFormError('Add at least one person');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const saved = await saveEventLabour(bookingId, lines, existing?.updatedAt ?? null);
      onChanged();
      showToast({ message: `Saved crew labour · ${formatCents(saved.totals.earnedCents)}` });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      if (err instanceof ApiError && err.status === 409) {
        // Someone else saved: show their version so nothing is overwritten.
        const latest = await getEventLabour(bookingId).catch(() => null);
        setExisting(latest);
        if (latest) setRows(rowsFrom(latest));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      title={existing ? 'Crew labour' : 'Add labour'}
      subtitle={eventTitle}
      dirty={dirty}
      busy={saving}
      onClose={onClose}
      footer={
        <SheetButton busy={saving} disabled={loading || lines.length === 0} onClick={handleSave}>
          {saving ? 'Saving…' : totalCents > 0 ? `Save ${formatCents(totalCents)}` : 'Save labour'}
        </SheetButton>
      }
    >
      {loading ? (
        <p className="py-16 text-center text-sm text-[var(--flat-text-ghost)]">Loading…</p>
      ) : (
        <div className="space-y-3">
          {rows.length > 0 ? (
            <ul className="space-y-2">
              {rows.map((row, i) => (
                <LabourRow
                  key={row.id}
                  row={row}
                  index={i}
                  member={row.crewMemberId ? crew.find((m) => m.id === row.crewMemberId) : undefined}
                  matches={!row.crewMemberId && row.name.trim() ? available.filter((m) => m.name.toLowerCase().includes(row.name.trim().toLowerCase())).slice(0, 3) : []}
                  inCrew={crew.some((m) => m.name.trim().toLowerCase() === row.name.trim().toLowerCase())}
                  focus={focus?.rowId === row.id ? focus.field : null}
                  error={rowErrors[row.id]}
                  canRemove={row.paidCents === 0}
                  onChange={(patch) => update(row.id, patch)}
                  onUseCrew={(m) => {
                    update(row.id, fromCrew(m));
                    setFocus({ rowId: row.id, field: 'hours' });
                  }}
                  onSaveToCrew={() => saveToCrew(row)}
                  onRemove={() => {
                    setRows((rs) => rs.filter((r) => r.id !== row.id));
                    touch();
                  }}
                />
              ))}
            </ul>
          ) : null}

          {choosing ? (
            <CrewChooser
              available={available}
              loaded={crewLoaded}
              canClose={rows.length > 0}
              onPick={addFromCrew}
              onOneOff={addOneOff}
              onClose={() => setChoosing(false)}
            />
          ) : rows.length < MAX_LABOUR_LINES ? (
            <button type="button" onClick={() => setChoosing(true)} className="flex items-center gap-1.5 px-1 py-1 text-xs font-bold text-[var(--neon-cyan)]">
              <Plus size={14} /> <span className="text-xs font-bold">Add person</span>
            </button>
          ) : null}

          {rows.length > 0 ? (
            <>
              <div className="flex items-baseline justify-between rounded-2xl bg-white/[0.04] px-3.5 py-3">
                <span className="text-xs text-[var(--flat-text-faint)]">{lines.length ? labourSummaryLabel({ people: lines.length, minutes: totalMinutes }) : 'Enter hours'}</span>
                <span className="text-[20px] font-bold tabular-nums text-white">{formatCents(totalCents)}</span>
              </div>
              <p className="text-center text-[11px] text-[var(--flat-text-faint)]">Counts as event cost now · record payments later · no HST added</p>
            </>
          ) : null}
          <SheetError message={formError} />
        </div>
      )}
    </BottomSheet>
  );
}

// "Who worked?": the active crew, each with their usual rate. Search shows
// once the list is long enough to need it.
function CrewChooser({
  available,
  loaded,
  canClose,
  onPick,
  onOneOff,
  onClose,
}: {
  available: CrewMemberDto[];
  loaded: boolean;
  canClose: boolean;
  onPick: (m: CrewMemberDto) => void;
  onOneOff: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? available.filter((m) => `${m.name} ${m.role ?? ''}`.toLowerCase().includes(q)) : available;
  }, [available, query]);

  return (
    <div className="rounded-2xl border border-[var(--flat-border)] bg-white/[0.03] p-2">
      <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Who worked?</p>
        {canClose ? (
          <button type="button" onClick={onClose} aria-label="Close crew list" className="flex size-7 items-center justify-center rounded-full text-white/40">
            <X size={14} />
          </button>
        ) : null}
      </div>
      {available.length > 6 ? (
        <label className="relative mb-1.5 block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search crew"
            aria-label="Search crew"
            className="w-full rounded-xl border border-[var(--flat-border)] bg-white/[0.04] py-2 pl-9 pr-3 text-base text-white outline-none placeholder:text-[var(--flat-text-faint)]"
          />
        </label>
      ) : null}
      {!loaded ? (
        <p className="px-2 py-3 text-xs text-[var(--flat-text-ghost)]">Loading crew…</p>
      ) : shown.length > 0 ? (
        <ul className="max-h-[42dvh] divide-y divide-[var(--flat-border)] overflow-y-auto">
          {shown.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m)} className="flex w-full items-center gap-3 px-2 py-2.5 text-left">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-bold text-white">{m.name.charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-white">{m.name}</span>
                  {m.role ? <span className="block truncate text-xs text-[var(--flat-text-faint)]">{m.role}</span> : null}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--flat-text-dim)]">
                  {m.defaultRateCents !== null ? `${formatCents(m.defaultRateCents)}/h` : 'No rate'}
                </span>
                <ChevronRight size={15} className="shrink-0 text-white/25" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-2 py-3 text-xs text-[var(--flat-text-faint)]">
          {query.trim() ? `No crew match “${query.trim()}”.` : available.length === 0 && loaded ? 'No one else on the crew list yet.' : ''}
        </p>
      )}
      <button type="button" onClick={onOneOff} className="mt-1 flex w-full items-center gap-2 border-t border-[var(--flat-border)] px-2 pb-1 pt-2.5 text-left text-xs font-bold text-[var(--neon-cyan)]">
        <UserPlus size={14} /> <span className="text-xs font-bold">Someone not on the list</span>
      </button>
    </div>
  );
}

function LabourRow({
  row,
  index,
  member,
  matches,
  inCrew,
  focus,
  error,
  canRemove,
  onChange,
  onUseCrew,
  onSaveToCrew,
  onRemove,
}: {
  row: Row;
  index: number;
  member: CrewMemberDto | undefined; // the profile, for a crew row
  matches: CrewMemberDto[]; // crew whose name fits what's typed on a one-off row
  inCrew: boolean;
  focus: 'name' | 'hours' | null;
  error?: string;
  canRemove: boolean;
  onChange: (patch: Partial<Row>) => void;
  onUseCrew: (m: CrewMemberDto) => void;
  onSaveToCrew: () => void;
  onRemove: () => void;
}) {
  const label = row.name.trim() || `person ${index + 1}`;
  const parsed = !isBlank(row) ? parseRow(row) : null;
  const usualRate = member?.defaultRateCents ?? null;
  const caption = row.crewMemberId
    ? [row.role, usualRate !== null ? `usual ${formatCents(usualRate)}/h` : null].filter(Boolean).join(' · ')
    : row.name.trim()
      ? 'One-off'
      : '';

  return (
    <li className={`rounded-2xl border bg-white/[0.03] p-2.5 ${error ? 'border-[rgba(244,114,182,0.45)]' : 'border-[var(--flat-border)]'}`}>
      <div className="flex items-center gap-2">
        {row.crewMemberId ? (
          <span className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-xs font-bold text-white">{row.name.charAt(0).toUpperCase()}</span>
            <span className="truncate text-base font-bold text-white">{row.name}</span>
          </span>
        ) : (
          <input
            value={row.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Name"
            aria-label={`Person ${index + 1} name`}
            autoFocus={focus === 'name'}
            autoComplete="off"
            autoCapitalize="words"
            maxLength={80}
            className="min-w-0 flex-1 bg-transparent px-1 text-base font-bold text-white outline-none placeholder:font-normal placeholder:text-[var(--flat-text-faint)]"
          />
        )}
        {canRemove ? (
          <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className="flex size-8 shrink-0 items-center justify-center rounded-full text-white/40">
            <X size={15} />
          </button>
        ) : null}
      </div>

      {/* A typed name that's already on the crew list: use their profile. */}
      {matches.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5 px-1">
          {matches.map((m) => (
            <button key={m.id} type="button" onClick={() => onUseCrew(m)} className="rounded-full border border-[var(--flat-border)] px-2.5 py-1 text-[11px] font-bold text-[var(--flat-text-dim)]">
              <span className="text-[11px] font-bold">
                Use {m.name}
                {m.defaultRateCents !== null ? ` · ${formatCents(m.defaultRateCents)}/h` : ''}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-1.5">
        <label className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-[var(--flat-border)] bg-white/[0.04] px-2.5 py-1.5">
          <input
            value={row.hoursText}
            onChange={(e) => onChange({ hoursText: e.target.value.replace(/[^\d.,:h]/gi, '') })}
            inputMode="decimal"
            placeholder="Hours"
            aria-label={`Hours for ${label}`}
            autoFocus={focus === 'hours'}
            className="w-full min-w-0 bg-transparent text-right text-base tabular-nums text-white outline-none placeholder:text-white/25"
          />
          <span className="shrink-0 text-xs text-white/50">h</span>
        </label>
        <span className="shrink-0 text-xs text-white/40">×</span>
        <label className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-[var(--flat-border)] bg-white/[0.04] px-2.5 py-1.5">
          <span className="shrink-0 text-xs text-white/50">$</span>
          <input
            value={row.rateText}
            onChange={(e) => onChange({ rateText: e.target.value.replace(/[^\d.,]/g, '') })}
            inputMode="decimal"
            placeholder="0.00"
            aria-label={`Hourly rate for ${label}`}
            className="w-full min-w-0 bg-transparent text-right text-base tabular-nums text-white outline-none placeholder:text-white/25"
          />
          <span className="shrink-0 text-xs text-white/50">/h</span>
        </label>
        <span className="w-[72px] shrink-0 text-right text-sm font-bold tabular-nums text-white">
          {parsed?.ok ? formatCents(lineAmountCents(parsed.line.minutes, parsed.line.rateCents)) : <span className="text-white/25">—</span>}
        </span>
      </div>

      {caption || row.paidCents > 0 || (!row.crewMemberId && row.name.trim() && !inCrew) ? (
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
          <p className="min-w-0 truncate text-[11px] text-[var(--flat-text-faint)]">
            {[caption, row.paidCents > 0 ? `${formatCents(row.paidCents)} paid` : null].filter(Boolean).join(' · ')}
          </p>
          {!row.crewMemberId && row.name.trim() && !inCrew ? (
            <button type="button" onClick={onSaveToCrew} className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[var(--neon-cyan)]">
              <UserPlus size={12} /> <span className="text-[11px] font-bold">Save to crew</span>
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-1.5 px-1 text-xs text-[var(--neon-pink)]">{error}</p> : null}
    </li>
  );
}
