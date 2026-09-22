'use client';

import { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, HelpCircle, X } from 'lucide-react';
import { AiConfidence, AiParsedBooking } from '@/lib/aiParse';
import { Booking, EquipmentLine, blankBooking, blankEquipmentLine } from '@/lib/bookingTypes';
import { colorAlpha } from '@/lib/colorAlpha';

const REQUIRED_FIELDS = ['client.name', 'client.email', 'schedule.eventDate', 'venue.location'] as const;

const FIELD_LABELS: Record<string, string> = {
  'client.name': 'Client name',
  'client.email': 'Client email',
  'client.phone': 'Client phone',
  'schedule.eventDate': 'Event date',
  'schedule.setupTime': 'Setup time',
  'schedule.startTime': 'Start time',
  'schedule.endTime': 'End time',
  'schedule.pickupDate': 'Pickup date',
  'schedule.pickupTime': 'Pickup time',
  'venue.eventType': 'Event type',
  'venue.location': 'Venue / location',
};

const SCALAR_FIELDS = Object.keys(FIELD_LABELS);

const FIELD_TYPES: Record<string, string> = {
  'schedule.eventDate': 'date',
  'schedule.pickupDate': 'date',
};

const TIER_STYLE = {
  confirmed: { color: 'var(--neon-green)', bg: 'rgba(0,255,136,0.06)', border: 'rgba(0,255,136,0.25)', Icon: CheckCircle2, title: 'Auto-filled' },
  assumed: { color: 'var(--neon-orange)', bg: 'rgba(251,146,60,0.06)', border: 'rgba(251,146,60,0.3)', Icon: HelpCircle, title: 'Needs confirmation' },
  missing: { color: 'var(--neon-pink)', bg: 'rgba(244,114,182,0.06)', border: 'rgba(244,114,182,0.3)', Icon: AlertCircle, title: 'Missing — required' },
} as const;

interface Props {
  parsed: AiParsedBooking;
  onCancel: () => void;
  onConfirm: (booking: Booking) => void;
}

export default function AiReviewPanel({ parsed, onCancel, onConfirm }: Props) {
  const [fields, setFields] = useState<Record<string, string>>(() => ({
    'client.name': parsed.client.name || '',
    'client.email': parsed.client.email || '',
    'client.phone': parsed.client.phone || '',
    'schedule.eventDate': parsed.schedule.eventDate || '',
    'schedule.setupTime': parsed.schedule.setupTime || '',
    'schedule.startTime': parsed.schedule.startTime || '',
    'schedule.endTime': parsed.schedule.endTime || '',
    'schedule.pickupDate': parsed.schedule.pickupDate || '',
    'schedule.pickupTime': parsed.schedule.pickupTime || '',
    'venue.eventType': parsed.venue.eventType || '',
    'venue.location': parsed.venue.location || '',
  }));
  const [equipment, setEquipment] = useState<(EquipmentLine & { confidence: AiConfidence })[]>(() =>
    parsed.equipment.map((e, i) => ({ ...blankEquipmentLine(), id: -(i + 1), itemName: e.itemName, spec: e.spec, qty: e.qty, confidence: e.confidence })),
  );
  const [services, setServices] = useState<{ name: string; confidence: AiConfidence }[]>(() =>
    parsed.services.map((s) => ({ name: s.name, confidence: s.confidence })),
  );
  const [notes, setNotes] = useState(parsed.notes || '');

  const setField = (path: string, value: string) => setFields((prev) => ({ ...prev, [path]: value }));

  // Grouped once, from the draft's initial values — not recalculated as
  // the user types, otherwise a "missing" field would jump to a different
  // tier (and lose focus) after the very first keystroke.
  const [groups] = useState<Record<AiConfidence, string[]>>(() => {
    const byTier: Record<AiConfidence, string[]> = { confirmed: [], assumed: [], missing: [] };
    for (const path of SCALAR_FIELDS) {
      const value = fields[path];
      const isRequired = (REQUIRED_FIELDS as readonly string[]).includes(path);
      if (isRequired && !value.trim()) {
        byTier.missing.push(path);
      } else if (!value.trim()) {
        continue;
      } else {
        const confidence = parsed.confidence[path] ?? 'confirmed';
        byTier[confidence === 'missing' ? 'confirmed' : confidence].push(path);
      }
    }
    return byTier;
  });

  const canSave = (REQUIRED_FIELDS as readonly string[]).every((path) => fields[path]?.trim());

  const handleConfirm = () => {
    if (!canSave) return;
    const base = blankBooking();
    const booking: Booking = {
      ...base,
      eventTitle: `${fields['client.name'] || 'Untitled'} – ${fields['venue.eventType'] || 'Event'}`,
      clientName: fields['client.name'],
      clientEmail: fields['client.email'],
      clientPhone: fields['client.phone'],
      eventType: fields['venue.eventType'] || 'Other',
      venueName: fields['venue.location'],
      venueAddress: '',
      eventDate: fields['schedule.eventDate'],
      setupTime: fields['schedule.setupTime'],
      startTime: fields['schedule.startTime'],
      endTime: fields['schedule.endTime'],
      pickupDate: fields['schedule.pickupDate'],
      pickupTime: fields['schedule.pickupTime'],
      notes,
      status: 'Tentative',
      equipment: equipment.map(({ confidence: _confidence, ...rest }) => rest),
      services: services.map((s) => s.name),
    };
    onConfirm(booking);
  };

  return (
    <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-base font-bold text-white">AI review</p>
          <p className="mt-0.5 text-xs text-[var(--flat-text-faint)]">Check the extracted details before saving</p>
        </div>
        <button type="button" onClick={onCancel} className="p-1 text-[var(--flat-text-faint)]">
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3">
        {(['missing', 'assumed', 'confirmed'] as AiConfidence[]).map((tier) => {
          if (groups[tier].length === 0) return null;
          const style = TIER_STYLE[tier];
          return (
            <Tier key={tier} style={style} subtitle={tier === 'missing' ? "The email didn't include these — fill them in to save." : tier === 'assumed' ? 'Assumed or ambiguous — please verify.' : undefined}>
              {groups[tier].map((path) => (
                <FieldRow
                  key={path}
                  label={FIELD_LABELS[path]}
                  value={fields[path]}
                  onChange={(v) => setField(path, v)}
                  color={style.color}
                  type={FIELD_TYPES[path]}
                />
              ))}
            </Tier>
          );
        })}

        {equipment.length > 0 && <EquipmentGroup equipment={equipment} onChange={setEquipment} />}
        {services.length > 0 && <ServicesGroup services={services} onChange={setServices} />}

        <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Notes (non-scheduling info)</p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Quote deadlines, special requests, etc. — never scheduling data."
            className="w-full resize-none rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-input)] p-3 text-[13px] text-white outline-none"
          />
        </div>
      </div>

      <div className="mt-5 flex gap-2.5">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-[var(--flat-border)] py-3.5 text-[13px] font-bold text-[var(--flat-text-dim)]">
          Discard
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!canSave}
          className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[var(--neon-green)] py-3.5 text-[13px] font-bold text-[#0a0a0a] disabled:opacity-40"
        >
          <Check size={16} />
          Confirm and save
        </button>
      </div>
      {!canSave && <p className="mt-2 text-center text-[11px] text-[var(--neon-pink)]">Fill in the required fields above (red) to enable saving.</p>}
    </div>
  );
}

function Tier({ style, subtitle, children }: { style: (typeof TIER_STYLE)[AiConfidence]; subtitle?: string; children: React.ReactNode }) {
  const { Icon, color, bg, border, title } = style;
  return (
    <div className="rounded-xl border p-3.5" style={{ borderColor: border, backgroundColor: bg }}>
      <div className="flex items-center gap-2">
        <Icon size={15} style={{ color }} />
        <p className="text-[11px] font-bold uppercase tracking-[0.04em]" style={{ color }}>
          {title}
        </p>
      </div>
      {subtitle ? <p className="mt-1 text-[11px] text-[var(--flat-text-faint)]">{subtitle}</p> : null}
      <div className="mt-2.5 space-y-2">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  color,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
  type?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-[0.04em] text-[var(--flat-text-faint)]">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
        className="w-full rounded-lg border bg-[var(--flat-surface-input)] px-2.5 py-2 text-[13px] text-white outline-none"
        style={{ borderColor: colorAlpha(color, 40), colorScheme: 'dark' }}
      />
    </div>
  );
}

function EquipmentGroup({
  equipment,
  onChange,
}: {
  equipment: (EquipmentLine & { confidence: AiConfidence })[];
  onChange: (items: (EquipmentLine & { confidence: AiConfidence })[]) => void;
}) {
  const update = (i: number, patch: Partial<EquipmentLine>) => onChange(equipment.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  return (
    <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] p-3.5">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Equipment</p>
      <div className="space-y-2">
        {equipment.map((item, i) => {
          const color = TIER_STYLE[item.confidence === 'missing' ? 'missing' : item.confidence === 'assumed' ? 'assumed' : 'confirmed'].color;
          return (
            <div key={item.id} className="rounded-lg border p-2.5" style={{ borderColor: colorAlpha(color, 30) }}>
              <div className="flex items-center gap-2">
                <input
                  value={item.itemName}
                  onChange={(e) => update(i, { itemName: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-white outline-none"
                />
                <input
                  value={String(item.qty)}
                  onChange={(e) => update(i, { qty: parseInt(e.target.value) || 1 })}
                  onFocus={(e) => e.target.select()}
                  className="w-10 rounded border border-[var(--flat-border)] bg-[var(--flat-surface-input)] py-1 text-center text-xs text-white outline-none"
                />
              </div>
              <input
                value={item.spec}
                onChange={(e) => update(i, { spec: e.target.value })}
                placeholder="spec / dimensions"
                className="mt-1.5 w-full rounded border border-[var(--flat-border)] bg-[var(--flat-surface-input)] px-2 py-1 text-[11px] text-[var(--flat-text-dim)] outline-none"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ServicesGroup({
  services,
  onChange,
}: {
  services: { name: string; confidence: AiConfidence }[];
  onChange: (items: { name: string; confidence: AiConfidence }[]) => void;
}) {
  const update = (i: number, name: string) => onChange(services.map((s, idx) => (idx === i ? { ...s, name } : s)));
  return (
    <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] p-3.5">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Services</p>
      <div className="flex flex-wrap gap-1.5">
        {services.map((s, i) => {
          const color = TIER_STYLE[s.confidence === 'missing' ? 'missing' : s.confidence === 'assumed' ? 'assumed' : 'confirmed'].color;
          return (
            <input
              key={i}
              value={s.name}
              onChange={(e) => update(i, e.target.value)}
              className="rounded-full border px-2.5 py-1.5 text-[11px]"
              style={{ borderColor: colorAlpha(color, 40), backgroundColor: colorAlpha(color, 10), color }}
            />
          );
        })}
      </div>
    </div>
  );
}
