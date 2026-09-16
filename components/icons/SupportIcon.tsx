import Svg, { Path } from 'react-native-svg';

interface SupportIconProps {
  size?: number;
  color?: string;
}

// Traced from the provided reference SVG (300 x 82 viewBox — a horizontal
// truss/support beam).
export default function SupportIcon({ size = 48, color = '#ffffff' }: SupportIconProps) {
  const height = (size * 82) / 300;

  return (
    <Svg width={size} height={height} viewBox="0 0 300 82">
      <Path
        fill={color}
        d="M298,6h-6V2c0-1.1-.9-2-2-2H10c-1.1,0-2,.9-2,2v4H2c-1.1,0-2,.9-2,2v10c0,1.1.9,2,2,2h6v44h-4c-1.1,0-2,.9-2,2v14c0,1.1.9,2,2,2h16c1.1,0,2-.9,2-2v-2h256v2c0,1.1.9,2,2,2h16c1.1,0,2-.9,2-2v-14c0-1.1-.9-2-2-2h-4V20h6c1.1,0,2-.9,2-2v-10c0-1.1-.9-2-2-2ZM22,68v-2c0-1.1-.9-2-2-2h-3V20h3c1.1,0,2-.9,2-2v-8h115.69l-75.69,58H22ZM74,68L147.73,10h1.59l76.68,58H74ZM283,64h-3c-1.1,0-2,.9-2,2v2h-40L159.36,10h118.64v8c0,1.1.9,2,2,2h3v44Z"
      />
    </Svg>
  );
}
