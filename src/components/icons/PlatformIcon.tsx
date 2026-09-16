interface PlatformIconProps {
  size?: number;
  color?: string;
  className?: string;
}

// Custom "stage platform" glyph (risers + legs), matching the original
// icon used before the web port. strokeWidth is scaled to land at the same
// apparent line weight as the neighboring lucide icons in the nav.
export default function PlatformIcon({ size = 22, color = 'currentColor', className }: PlatformIconProps) {
  const strokeWidth = (3.4 / 22) * size;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className}>
      <g fill="none" stroke={color} strokeLinejoin="round" strokeLinecap="round" strokeMiterlimit={10} strokeWidth={strokeWidth}>
        <path d="m5 35h54v4h-54z" />
        <path d="m59 35-8-18h-38l-8 18" />
        <path d="m6 39v8l13-8v8" />
        <path d="m45 39v8" />
        <path d="m32 17v18" />
        <path d="m9.44 25h22.56 22.56" />
        <path d="m32 47v-8l-13 8-13-8" />
        <path d="m58 39-13 8-13-8" />
        <path d="m45 39 13 8v-8 8" />
        <path d="m45 47v-8l-13 8-13-8" />
      </g>
    </svg>
  );
}
