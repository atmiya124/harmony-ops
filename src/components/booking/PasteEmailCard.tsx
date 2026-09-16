'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { AiParsedBooking, AiParseError, parseBookingEmail } from '@/lib/aiParse';

export default function PasteEmailCard({ onParsed }: { onParsed: (parsed: AiParsedBooking) => void }) {
  const [expanded, setExpanded] = useState(true);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseBookingEmail(text.trim());
      onParsed(parsed);
    } catch (err) {
      setError(err instanceof AiParseError ? err.message : 'Something went wrong generating that draft.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-5 overflow-hidden rounded-xl border border-[rgba(167,139,250,0.3)] bg-[var(--flat-surface)]">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 p-3.5 text-left">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(167,139,250,0.18)]">
          <Sparkles size={16} className="text-[var(--neon-purple)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-white">Paste client email to pre-fill</p>
          <p className="mt-0.5 text-[11px] text-[var(--flat-text-faint)]">AI extracts client, schedule, venue & equipment</p>
        </div>
        {expanded ? (
          <ChevronUp size={18} className="shrink-0 text-[var(--flat-text-faint)]" />
        ) : (
          <ChevronDown size={18} className="shrink-0 text-[var(--flat-text-faint)]" />
        )}
      </button>

      {expanded && (
        <div className="space-y-2.5 px-3.5 pb-3.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the client's email, inquiry, or chat message here..."
            rows={6}
            className="w-full resize-none rounded-lg border border-[var(--flat-border)] bg-[var(--flat-surface-input)] p-3 text-[13px] text-white outline-none placeholder:text-[var(--flat-text-faint)]"
          />
          {error && <p className="text-xs text-[var(--neon-pink)]">{error}</p>}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!text.trim() || loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--neon-purple)] py-3 text-[13px] font-bold text-[#0a0a0a] disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? 'Generating draft…' : 'Generate draft'}
          </button>
        </div>
      )}
    </div>
  );
}
