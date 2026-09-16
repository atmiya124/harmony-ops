import { ReactNode } from 'react';

export interface ResultCard {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: ReactNode;
  large?: boolean;
  wide?: boolean;
}

export default function ResultCardGrid({ cards }: { cards: ResultCard[] }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border-t-2 border-x border-b border-x-transparent border-b-transparent bg-[var(--flat-surface)] p-4 ${
            card.wide ? 'col-span-2' : ''
          }`}
          style={{ borderTopColor: card.color }}
        >
          <div className="mb-2.5 flex h-8 items-center text-xl leading-none" style={{ color: card.color }}>
            {card.icon}
          </div>
          <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--flat-text-faint)]">{card.label}</p>
          <p className={`mt-1 font-bold ${card.large ? 'text-xl' : 'text-lg'}`} style={{ color: card.color }}>
            {card.value}
          </p>
          {card.sub ? <p className="mt-0.5 text-[11px] text-[var(--flat-text-ghost)]">{card.sub}</p> : null}
        </div>
      ))}
    </div>
  );
}
