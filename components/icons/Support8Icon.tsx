import Svg, { G, Rect, Polygon } from 'react-native-svg';

interface Support8IconProps {
  size?: number;
  color?: string;
}

// Traced from the provided reference SVG (465.77 x 82 viewBox — an 8ft
// truss segment with a double X cross-brace).
export default function Support8Icon({ size = 48, color = '#ffffff' }: Support8IconProps) {
  const height = (size * 82) / 465.77;

  return (
    <Svg width={size} height={height} viewBox="0 0 465.77 82">
      <G fill={color}>
        <Rect x="8" width="447" height="10" rx="2" ry="2" />
        <Rect y="6" width="22" height="14" rx="2" ry="2" />
        <Rect x="443.77" y="6" width="22" height="14" rx="2" ry="2" />
        <Rect x="8" y="14" width="9" height="56" />
        <Rect x="448.77" y="14" width="9" height="56" />
        <Rect x="8" y="68" width="445" height="10" rx="2" ry="2" />
        <Rect x="2" y="64" width="20" height="18" rx="2" ry="2" />
        <Rect x="443.77" y="64" width="20" height="18" rx="2" ry="2" />
        <Polygon points="62 68 74 68 149 9 139 9 62 68" />
        <Polygon points="226 68 238 68 158 9 148 9 226 68" />
        <Polygon points="238 68 250 68 325 9 315 9 238 68" />
        <Polygon points="402 68 414 68 334 9 324 9 402 68" />
      </G>
    </Svg>
  );
}
