import { BookingStatus } from '@/lib/bookingTypes';

export const statusColor: Record<BookingStatus, string> = {
  Tentative: 'var(--neon-orange)',
  Confirmed: 'var(--neon-green)',
  Completed: 'var(--neon-cyan)',
  Cancelled: 'var(--neon-pink)',
};

export default function StatusBadge({ status, large }: { status: BookingStatus; large?: boolean }) {
  const color = statusColor[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${large ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-[11px]'}`}
      style={{ backgroundColor: `${colorToRgba(color)}`, borderColor: `${colorToRgba(color, 0.25)}`, color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-bold">{status}</span>
    </span>
  );
}

// CSS custom properties can't be alpha-blended with a suffix like hex can —
// resolve via color-mix so the badge keeps the same soft-fill look.
function colorToRgba(cssVar: string, alpha = 0.1) {
  return `color-mix(in srgb, ${cssVar} ${alpha * 100}%, transparent)`;
}
