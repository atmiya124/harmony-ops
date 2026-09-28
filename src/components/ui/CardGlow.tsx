// Soft blue glow rising from the bottom edge of a card (the "next event"
// cards on Home and Bookings). Clips itself to the card's rounded shape, so
// the card itself needn't hide overflow — dropdowns inside it still show.
// Place it first inside a `relative` card and give the content `relative`.
export default function CardGlow({ radius = 'rounded-[28px]' }: { radius?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${radius}`}>
      <div
        className="absolute -bottom-24 left-1/2 h-48 w-[130%] -translate-x-1/2 rounded-[50%] blur-2xl"
        style={{ background: 'radial-gradient(ellipse at center, rgba(79, 110, 255, 0.55), rgba(79, 110, 255, 0.12) 50%, transparent 72%)' }}
      />
    </div>
  );
}
