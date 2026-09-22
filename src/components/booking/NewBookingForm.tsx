'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from 'lucide-react';
import { Booking, EVENT_TYPES, ALL_SERVICES, STATUSES, STEP_LABELS, blankEquipmentLine } from '@/lib/bookingTypes';
import { calculateLedWall } from '@/lib/ledCalculator';
import { AiParsedBooking } from '@/lib/aiParse';
import PasteEmailCard from './PasteEmailCard';

const EQUIPMENT_SUGGESTIONS = [
  'LED Wall',
  "Stage Panel 8x4'",
  "Stage Panel 4x4'",
  'Sound System',
  'Wireless Mic',
  'Truss Section',
  'Moving Head',
  'PAR Light',
  'Uplighting',
  'Projector',
];

interface Props {
  initial: Booking;
  isEdit: boolean;
  onCancel: () => void;
  onSave: (booking: Booking) => void;
  onAiParsed?: (parsed: AiParsedBooking, rawText: string) => void;
}

export default function NewBookingForm({ initial, isEdit, onCancel, onSave, onAiParsed }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Booking>(initial);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ledWidth, setLedWidth] = useState('');
  const [ledHeight, setLedHeight] = useState('');

  const set = <K extends keyof Booking>(field: K, value: Booking[K]) => setForm((prev) => ({ ...prev, [field]: value }));

  const addEquipment = (name = '') => set('equipment', [...form.equipment, { ...blankEquipmentLine(), itemName: name }]);
  const updateEquipment = (i: number, patch: Partial<Booking['equipment'][number]>) =>
    set('equipment', form.equipment.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const removeEquipment = (i: number) => set('equipment', form.equipment.filter((_, idx) => idx !== i));

  const toggleService = (name: string) =>
    set('services', form.services.includes(name) ? form.services.filter((s) => s !== name) : [...form.services, name]);

  const addLedFromCalc = () => {
    const w = parseFloat(ledWidth);
    const h = parseFloat(ledHeight);
    if (!w || !h) return;
    const result = calculateLedWall(w, h, 'ft');
    if (!result) return;
    set('equipment', [
      ...form.equipment,
      {
        ...blankEquipmentLine(),
        itemName: 'LED Wall (P2.6 · 500×500mm)',
        spec: `${w}x${h}ft → ${result.totalPixelsW}×${result.totalPixelsH}px, ${result.totalPowerKW.toFixed(1)}kW`,
      },
    ]);
    setLedWidth('');
    setLedHeight('');
  };

  const next = () => setStep((s) => Math.min(5, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleSave = () => onSave({ ...form, equipment: form.equipment.filter((e) => e.itemName.trim()) });

  return (
    <div className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <button type="button" onClick={() => (step > 1 ? back() : onCancel())} className="p-1 text-white">
          <ArrowLeft size={18} />
        </button>
        <p className="text-[15px] font-bold text-white">{isEdit ? 'Edit Booking' : 'New Booking'}</p>
        <div className="w-[26px]" />
      </div>

      <div className="flex gap-1.5">
        {STEP_LABELS.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i + 1 <= step ? 'bg-[var(--neon-mint)]' : 'bg-[var(--flat-border)]'}`} />
        ))}
      </div>
      <div className="mt-1.5 flex">
        {STEP_LABELS.map((label, i) => (
          <span key={label} className={`flex-1 text-center text-[10px] ${i + 1 === step ? 'font-bold text-[var(--neon-mint)]' : 'text-[var(--flat-text-fainter)]'}`}>
            {label}
          </span>
        ))}
      </div>

      {step === 1 && !isEdit && onAiParsed && (
        <div className="mt-4">
          <PasteEmailCard onParsed={onAiParsed} />
        </div>
      )}

      <div className="mt-5 space-y-4">
        {step === 1 && (
          <>
            <StepHeader title="Event & Client Info" sub="Basic information about the event" />
            <Field label="Event Title" value={form.eventTitle} onChange={(v) => set('eventTitle', v)} placeholder="e.g. Martinez Quinceañera" />
            <div className="space-y-3 rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Client Contact</p>
              <Field label="Client Name" value={form.clientName} onChange={(v) => set('clientName', v)} placeholder="Full name" />
              <Field label="Client Phone" value={form.clientPhone} onChange={(v) => set('clientPhone', v)} placeholder="(555) 234-5678" />
              <Field label="Client Email" value={form.clientEmail} onChange={(v) => set('clientEmail', v)} placeholder="client@example.com" />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <StepHeader title="Event Schedule" sub="Set up your event timeline" />
            <Field label="Event Date" value={form.eventDate} onChange={(v) => set('eventDate', v)} placeholder="2026-10-05" />
            <div className="grid grid-cols-3 gap-2">
              <Field label="Setup" value={form.setupTime} onChange={(v) => set('setupTime', v)} placeholder="09:00" />
              <Field label="Start" value={form.startTime} onChange={(v) => set('startTime', v)} placeholder="18:00" />
              <Field label="End" value={form.endTime} onChange={(v) => set('endTime', v)} placeholder="22:00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pickup Date" value={form.pickupDate} onChange={(v) => set('pickupDate', v)} placeholder="2026-10-06" />
              <Field label="Pickup Time" value={form.pickupTime} onChange={(v) => set('pickupTime', v)} placeholder="10:00" />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <StepHeader title="Venue Details" sub="Where is the event taking place?" />
            <div className="space-y-2 rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Event Type</p>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('eventType', t)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      form.eventType === t
                        ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)] font-bold text-[#0a0a0a]'
                        : 'border-[var(--flat-border)] bg-[var(--flat-surface-input)] text-[var(--flat-text-dim)]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Venue Name" value={form.venueName} onChange={(v) => set('venueName', v)} placeholder="Riverside Hall" />
            <Field label="Venue Address" value={form.venueAddress} onChange={(v) => set('venueAddress', v)} placeholder="123 Main St, City" />
          </>
        )}

        {step === 4 && (
          <>
            <StepHeader title="Equipment List" sub="Add items with sizes and quantities" />
            <div className="space-y-2">
              {form.equipment.map((item, i) => (
                <div key={item.id} className="rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[rgba(0,212,255,0.2)] text-[10px] font-bold text-[var(--neon-cyan)]">
                      {i + 1}
                    </span>
                    <input
                      value={item.itemName}
                      onChange={(e) => updateEquipment(i, { itemName: e.target.value })}
                      placeholder="Item name"
                      className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-white outline-none"
                    />
                    <button type="button" onClick={() => removeEquipment(i)} className="text-[var(--flat-text-fainter)]">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-2 flex gap-2 pl-7">
                    <input
                      value={item.spec}
                      onChange={(e) => updateEquipment(i, { spec: e.target.value })}
                      placeholder="Size / spec"
                      className="min-w-0 flex-1 rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-input)] px-2.5 py-1.5 text-xs text-[var(--flat-text-dim)] outline-none"
                    />
                    <input
                      value={String(item.qty)}
                      onChange={(e) => updateEquipment(i, { qty: parseInt(e.target.value) || 1 })}
                      onFocus={(e) => e.target.select()}
                      className="w-12 rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-input)] py-1.5 text-center text-xs text-white outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[rgba(251,146,60,0.3)] bg-[rgba(251,146,60,0.06)] p-3.5">
              <p className="text-xs font-bold text-[var(--neon-orange)]">Quick-add LED wall</p>
              <p className="mb-2 mt-0.5 text-[10px] text-[var(--flat-text-faint)]">Enter feet — resolves against the panel catalog</p>
              <div className="flex items-center gap-2">
                <input
                  value={ledWidth}
                  onChange={(e) => setLedWidth(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="Width"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-input)] px-2.5 py-2 text-center text-sm text-white outline-none"
                />
                <span className="text-[var(--flat-text-fainter)]">×</span>
                <input
                  value={ledHeight}
                  onChange={(e) => setLedHeight(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="Height"
                  className="min-w-0 flex-1 rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-input)] px-2.5 py-2 text-center text-sm text-white outline-none"
                />
                <button type="button" onClick={addLedFromCalc} className="shrink-0 rounded-lg bg-[var(--neon-orange)] p-2.5 text-[#0a0a0a]">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => addEquipment()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--flat-border)] py-3 text-sm text-[var(--flat-text-dim)]"
            >
              <Plus size={16} /> Add Equipment Item
            </button>

            <button type="button" onClick={() => setShowSuggestions((v) => !v)} className="text-xs text-[var(--neon-cyan)]">
              {showSuggestions ? '▲ Hide suggestions' : '▼ Quick-add common items'}
            </button>
            {showSuggestions && (
              <div className="flex flex-wrap gap-1.5">
                {EQUIPMENT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addEquipment(s)}
                    className="rounded-full border border-[var(--flat-border)] bg-[var(--flat-surface-alt)] px-2.5 py-1.5 text-[11px] text-[var(--flat-text-dim)]"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {step === 5 && (
          <>
            <StepHeader title="Services & Notes" />
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Services</p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_SERVICES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleService(s)}
                    className={`rounded-xl border px-3 py-2.5 text-left text-xs ${
                      form.services.includes(s)
                        ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)] font-bold text-[#0a0a0a]'
                        : 'border-[var(--flat-border)] bg-[var(--flat-surface-input)] text-[var(--flat-text-dim)]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Notes</p>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                rows={3}
                placeholder="Any special instructions..."
                className="w-full resize-none rounded-xl border border-[var(--flat-border)] bg-[var(--flat-surface-input)] p-3 text-sm text-white outline-none"
              />
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('status', s)}
                    className={`rounded-full border px-3.5 py-2 text-xs font-bold ${
                      form.status === s ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)] text-[#0a0a0a]' : 'border-[var(--flat-border)] bg-[var(--flat-surface-input)] text-[var(--flat-text-dim)]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex gap-2.5">
        {step > 1 && (
          <button type="button" onClick={back} className="flex-1 rounded-xl border border-[var(--flat-border)] py-3.5 text-[13px] font-bold text-[var(--flat-text-dim)]">
            Back
          </button>
        )}
        {step < 5 ? (
          <button type="button" onClick={next} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--neon-cyan)] py-3.5 text-[13px] font-bold text-[#0a0a0a]">
            Next <ArrowRight size={15} />
          </button>
        ) : (
          <button type="button" onClick={handleSave} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--neon-green)] py-3.5 text-[13px] font-bold text-[#0a0a0a]">
            <Check size={16} /> {isEdit ? 'Save Changes' : 'Save Booking'}
          </button>
        )}
      </div>
    </div>
  );
}

function StepHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <p className="text-[15px] font-bold text-white">{title}</p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--flat-text-faint)]">{sub}</p> : null}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-[var(--flat-text-dim)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-input)] px-3 py-2.5 text-sm text-white outline-none placeholder:text-[var(--flat-text-faint)]"
      />
    </label>
  );
}
