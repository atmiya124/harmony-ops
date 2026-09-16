interface Support8IconProps {
  size?: number;
  color?: string;
  className?: string;
}

// Traced from the same reference SVG used in the original app — an 8ft
// truss segment with a double X cross-brace (465.77 x 82 viewBox).
export default function Support8Icon({ size = 48, color = 'currentColor', className }: Support8IconProps) {
  const height = (size * 82) / 465.77;

  return (
    <svg width={size} height={height} viewBox="0 0 465.77 82" className={className}>
      <g fill={color}>
        <rect x="8" width="447" height="10" rx="2" ry="2" />
        <rect y="6" width="22" height="14" rx="2" ry="2" />
        <rect x="443.77" y="6" width="22" height="14" rx="2" ry="2" />
        <rect x="8" y="14" width="9" height="56" />
        <rect x="448.77" y="14" width="9" height="56" />
        <rect x="8" y="68" width="445" height="10" rx="2" ry="2" />
        <rect x="2" y="64" width="20" height="18" rx="2" ry="2" />
        <rect x="443.77" y="64" width="20" height="18" rx="2" ry="2" />
        <polygon points="62 68 74 68 149 9 139 9 62 68" />
        <polygon points="226 68 238 68 158 9 148 9 226 68" />
        <polygon points="238 68 250 68 325 9 315 9 238 68" />
        <polygon points="402 68 414 68 334 9 324 9 402 68" />
      </g>
    </svg>
  );
}
