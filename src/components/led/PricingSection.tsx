import { LedWallResult, calculateLedPrice } from '@/lib/ledCalculator';

export default function PricingSection({ results, ratePerSqFt }: { results: LedWallResult; ratePerSqFt: number }) {
  const total = calculateLedPrice(results.sqFt, ratePerSqFt);

  return (
    <div>
      <div className="mb-3.5 flex flex-col items-center rounded-xl border border-[rgba(52,211,153,0.18)] bg-[rgba(52,211,153,0.06)] py-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">Estimated total</p>
        <p className="mt-1.5 text-4xl font-bold tracking-tight text-[var(--neon-mint)]">
          ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </p>
      </div>

      <div className="flex items-center justify-between border-b border-[var(--flat-border)] py-2">
        <span className="text-xs text-[var(--flat-text-dim)]">Rate</span>
        <span className="text-sm font-medium text-white">${ratePerSqFt} / sq ft</span>
      </div>
      <div className="flex items-center justify-between border-b border-[var(--flat-border)] py-2">
        <span className="text-xs text-[var(--flat-text-dim)]">Screen area</span>
        <span className="text-sm font-medium text-white">{results.sqFt.toFixed(1)} sq ft</span>
      </div>

      <p className="mt-3 text-[10px] leading-tight text-[var(--flat-text-ghost)]">
        Basic flat-rate estimate — excludes rigging, crew, delivery, and taxes.
      </p>
    </div>
  );
}
