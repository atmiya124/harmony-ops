import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronRight } from 'lucide-react';

// Rounded dark card shared by every financial chart. `value` is the one
// number the card is about; the chart underneath gives it context.
export function ChartCard({
  title,
  value,
  href,
  footer,
  aside,
  size = 'tile',
  children,
}: {
  title: string;
  value: string;
  href?: string;
  footer?: React.ReactNode;
  // A compact chart beside the figure (the hero's period columns) rather
  // than underneath it.
  aside?: React.ReactNode;
  // `hero`: the single headline figure of a screen (one per view).
  size?: 'hero' | 'tile';
  children?: React.ReactNode;
}) {
  const hero = size === 'hero';
  const figure = (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className={`${hero ? 'text-sm' : 'text-xs'} text-[var(--flat-text-faint)]`}>{title}</p>
        {href ? <ChevronRight size={16} className="shrink-0 text-[var(--flat-text-faint)]" /> : null}
      </div>
      <p className={`mt-1 font-bold text-white ${hero ? 'text-[40px] leading-tight tracking-tight' : 'text-2xl'}`}>{value}</p>
      {footer ? <div className={hero ? 'mt-3' : 'mt-2'}>{footer}</div> : null}
    </div>
  );
  const body = (
    <>
      {aside ? (
        <div className="flex items-end justify-between gap-4">
          {figure}
          <div className="w-[44%] shrink-0">{aside}</div>
        </div>
      ) : (
        figure
      )}
      {children ? <div className={hero ? 'mt-3' : 'mt-2'}>{children}</div> : null}
    </>
  );
  const className = `block rounded-3xl border border-[var(--flat-border)] bg-[var(--flat-surface)] ${hero ? 'p-5' : 'p-4'}`;
  return href ? (
    <Link href={href} className={`${className} transition hover:border-[var(--flat-border-strong)]`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

// "↓ 12% vs last month". Whether a direction is good depends on the metric
// (less spending is good), so the caller says which way is good. Color is
// never the only signal: the arrow and the sign carry direction too.
export function ChangeIndicator({ percent, comparedTo, upIsGood }: { percent: number | null; comparedTo: string; upIsGood: boolean }) {
  if (percent === null || !Number.isFinite(percent)) {
    return <p className="text-xs text-[var(--flat-text-faint)]">No data for {comparedTo}</p>;
  }
  const rounded = Math.round(percent);
  const up = rounded > 0;
  const flat = rounded === 0;
  const good = flat ? null : up === upIsGood;
  const color = good === null ? 'var(--flat-text-dim)' : good ? 'var(--neon-green)' : 'var(--neon-pink)';
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <p className="flex items-center gap-1 text-xs">
      {flat ? null : <Icon size={14} style={{ color }} aria-hidden />}
      <span className="font-bold" style={{ color }}>
        {flat ? 'No change' : `${Math.abs(rounded)}%`}
        {/* The arrow shows direction visually; spell it out for screen readers. */}
        {flat ? null : <span className="sr-only">{up ? ' increase' : ' decrease'}</span>}
      </span>
      <span className="text-[var(--flat-text-faint)]">vs {comparedTo}</span>
    </p>
  );
}
