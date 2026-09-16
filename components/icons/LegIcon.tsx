import Svg, { Defs, Mask, G, Rect, Ellipse, Circle, Path } from 'react-native-svg';

interface LegIconProps {
  size?: number;
  color?: string;
}

// Traced from the provided reference SVG (124 x 24.53 viewBox).
export default function LegIcon({ size = 64, color = '#ffffff' }: LegIconProps) {
  const height = (size * 24.53) / 124;

  return (
    <Svg width={size} height={height} viewBox="0 0 124 24.53">
      <Defs>
        <Mask id="legIconMask" x="-4.5" y="-19" width="128.5" height="64" maskUnits="userSpaceOnUse">
          <G>
            <Rect
              x="27.5"
              y="-51"
              width="64"
              height="128"
              transform="translate(46.5 72.5) rotate(-90)"
              fill="#fff"
            />
            <Ellipse cx="3.5" cy="13" rx="2.8" ry="8" />
            <Circle cx="30.5" cy="6.5" r="1.5" />
            <Ellipse cx="22.5" cy="3" rx="3.5" ry="2.2" />
            <Path d="M103.5,22.25V3.75c0-.41.34-.75.75-.75h0c.41,0,.75.34.75.75v18.5c0,.41-.34.75-.75.75h0c-.41,0-.75-.34-.75-.75Z" />
          </G>
        </Mask>
      </Defs>
      <G mask="url(#legIconMask)" fill={color}>
        <Rect
          x="45"
          y="-38.5"
          width="16"
          height="103"
          rx="4"
          ry="4"
          transform="translate(40 66) rotate(-90)"
        />
        <Path d="M100.5,22.5H5.5c-3.03,0-5.5-2.47-5.5-5.5v-8C0,5.97,2.47,3.5,5.5,3.5h95c3.03,0,5.5,2.47,5.5,5.5v8c0,3.03-2.47,5.5-5.5,5.5ZM5.5,6.5c-1.38,0-2.5,1.12-2.5,2.5v8c0,1.38,1.12,2.5,2.5,2.5h95c1.38,0,2.5-1.12,2.5-2.5v-8c0-1.38-1.12-2.5-2.5-2.5H5.5Z" />
        <Path d="M19,3.75h0c0-1.24,1.01-2.25,2.25-2.25h2.5c1.24,0,2.25,1.01,2.25,2.25h0c0,1.24-1.01,2.25-2.25,2.25h-2.5c-1.24,0-2.25-1.01-2.25-2.25Z" />
        <Path d="M23.75,7.5h-2.5c-2.07,0-3.75-1.68-3.75-3.75s1.68-3.75,3.75-3.75h2.5c2.07,0,3.75,1.68,3.75,3.75s-1.68,3.75-3.75,3.75ZM21.25,3c-.41,0-.75.34-.75.75s.34.75.75.75h2.5c.41,0,.75-.34.75-.75s-.34-.75-.75-.75h-2.5Z" />
        <Ellipse cx="22.69" cy="3.25" rx="1.44" ry="1.75" />
        <Ellipse cx="22.69" cy="3.25" rx="2.94" ry="3.25" />
        <Path d="M104,22V4l12-1c3.85-.35,6.5,2.8,6.5,10s-2.65,10.35-6.5,10l-12-1Z" />
        <Path d="M116.56,24.53c-.23,0-.46,0-.7-.03l-13.36-1.11V2.62l13.38-1.12c1.93-.17,3.66.38,5,1.6,2.07,1.89,3.12,5.22,3.12,9.89s-1.05,8-3.12,9.89c-1.18,1.08-2.66,1.64-4.32,1.64ZM105.5,20.62l10.62.88c1.12.1,2.01-.17,2.73-.83,1.38-1.26,2.14-3.99,2.14-7.67s-.76-6.41-2.14-7.68c-.72-.66-1.62-.93-2.72-.83l-10.64.89v15.24Z" />
      </G>
    </Svg>
  );
}
