import Svg, { G, Path } from 'react-native-svg';

interface PlatformIconProps {
  size?: number;
  color?: string;
}

// Custom "stage platform" glyph (risers + legs), traced from the provided
// reference SVG (64x64 viewBox). The source used strokeWidth=2 tuned for a
// 64px render; at icon sizes (~22px) that reads as a hairline next to
// Ionicons' outline glyphs, so strokeWidth is scaled up here to land at the
// same apparent line weight as the neighboring Ionicons in the menu.
export default function PlatformIcon({ size = 22, color = '#ffffff' }: PlatformIconProps) {
  const strokeWidth = (3.4 / 22) * size;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <G
        fill="none"
        stroke={color}
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeMiterlimit={10}
        strokeWidth={strokeWidth}
      >
        <Path d="m5 35h54v4h-54z" />
        <Path d="m59 35-8-18h-38l-8 18" />
        <Path d="m6 39v8l13-8v8" />
        <Path d="m45 39v8" />
        <Path d="m32 17v18" />
        <Path d="m9.44 25h22.56 22.56" />
        <Path d="m32 47v-8l-13 8-13-8" />
        <Path d="m58 39-13 8-13-8" />
        <Path d="m45 39 13 8v-8 8" />
        <Path d="m45 47v-8l-13 8-13-8" />
      </G>
    </Svg>
  );
}
