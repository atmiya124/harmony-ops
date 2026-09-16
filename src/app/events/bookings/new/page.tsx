'use client';

import { useState } from 'react';
import { ArrowRight, Check, FileText, Mail, Plus, Sparkles, Trash2 } from 'lucide-react';

const stepLabels = ['Client', 'Schedule', 'Venue', 'Equipment', 'Services'];

const initialForm = {
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  eventDate: '',
  setupTime: '',
  startTime: '',
  endTime: '',
  pickupDetail: '',
  eventType: '',
  venueName: '',
  venueAddress: '',
  status: 'Tentative',
  notes: '',
  services: ['Sound System'],
  equipment: [{ id: '1', name: 'LED wall 8x14', qty: 1, spec: '3.9mm', dimensions: '8x14 ft' }],
};

export default function NewBookingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [pasteText, setPasteText] = useState('');
  const [review, setReview] = useState<Record<string, string>>({});

  const canNext = currentStep < stepLabels.length - 1;
  const canSave = currentStep === stepLabels.length - 1;

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAutoFill = async () => {
    try {
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });

      const data = await response.json();
      if (data?.parsed) {
        setReview(data.parsed);
      }
    } catch (error) {
      console.error('AI fill failed', error);
    }
  };

  return (
    <div className="mx-auto max-w-5xl pb-10">
      <div className="rounded-[28px] border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">New booking</p>
            <h2 className="mt-2 text-3xl font-bold text-white">5-step booking flow</h2>
          </div>
          <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
            <Mail className="size-4 text-emerald-300" />
            Paste client email
          </button>
        </div>

        <div className="mb-6 grid gap-2 md:grid-cols-5">
          {stepLabels.map((label, index) => (
            <div
              key={label}
              className={`rounded-2xl border px-3 py-2 text-center text-sm ${
                currentStep === index
                  ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200'
                  : 'border-slate-700 bg-slate-950/40 text-slate-300'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="rounded-[24px] border border-slate-700 bg-slate-950/50 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">{stepLabels[currentStep]}</h3>
            <span className="text-sm text-slate-400">Step {currentStep + 1} of {stepLabels.length}</span>
          </div>

          {currentStep === 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Client name" value={form.clientName} onChange={(v) => updateField('clientName', v)} />
              <InputField label="Phone" value={form.clientPhone} onChange={(v) => updateField('clientPhone', v)} />
              <div className="md:col-span-2">
                <InputField label="Email" value={form.clientEmail} onChange={(v) => updateField('clientEmail', v)} />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Event date" type="date" value={form.eventDate} onChange={(v) => updateField('eventDate', v)} />
              <InputField label="Setup time" type="time" value={form.setupTime} onChange={(v) => updateField('setupTime', v)} />
              <InputField label="Start time" type="time" value={form.startTime} onChange={(v) => updateField('startTime', v)} />
              <InputField label="End time" type="time" value={form.endTime} onChange={(v) => updateField('endTime', v)} />
              <div className="md:col-span-2">
                <InputField label="Pickup detail" value={form.pickupDetail} onChange={(v) => updateField('pickupDetail', v)} />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="grid gap-4 md:grid-cols-2">
              <InputField label="Event type" value={form.eventType} onChange={(v) => updateField('eventType', v)} />
              <InputField label="Venue name" value={form.venueName} onChange={(v) => updateField('venueName', v)} />
              <div className="md:col-span-2">
                <InputField label="Venue address" value={form.venueAddress} onChange={(v) => updateField('venueAddress', v)} />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-white">Equipment list</p>
                  <button className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-2.5 py-2 text-xs text-slate-200">
                    <Plus className="size-3.5" />
                    Add item
                  </button>
                </div>

                <div className="space-y-3">
                  {form.equipment.map((item) => (
                    <div key={item.id} className="grid gap-3 rounded-2xl border border-slate-700 bg-slate-950/50 p-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
                      <input value={item.name} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                      <input value={item.qty} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                      <input value={item.dimensions} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" />
                      <button className="rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-red-300">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-4">
              <InputField label="Services" value={form.services.join(', ')} onChange={(v) => updateField('services', v)} />
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Status</span>
                <select
                  value={form.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                >
                  <option value="Tentative">Tentative</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </label>
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Notes</span>
                <textarea
                  rows={5}
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
                />
              </label>
            </div>
          )}

          {Object.keys(review).length > 0 && (
            <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <div className="mb-2 flex items-center gap-2"><Sparkles className="size-4" /> AI review</div>
              <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-emerald-50">{JSON.stringify(review, null, 2)}</pre>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-slate-300">
              <FileText className="size-4 text-cyan-300" />
              Paste client email to pre-fill
            </div>
            <textarea
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              placeholder="Paste a client email, inquiry, or quote request..."
            />
            <button
              onClick={handleAutoFill}
              className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-400"
            >
              <Sparkles className="size-4" />
              AI fill booking
            </button>
          </div>

          <div className="mt-6 flex justify-between">
            <button
              disabled={currentStep === 0}
              onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
              className="rounded-2xl border border-slate-600 px-4 py-2.5 text-sm text-slate-200 disabled:opacity-40"
            >
              Previous
            </button>

            {canNext ? (
              <button
                onClick={() => setCurrentStep((step) => Math.min(stepLabels.length - 1, step + 1))}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Next
                <ArrowRight className="size-4" />
              </button>
            ) : (
              <button className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-emerald-400">
                <Check className="size-4" />
                Confirm and save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-2 text-sm text-slate-300">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-white"
      />
    </label>
  );
}
