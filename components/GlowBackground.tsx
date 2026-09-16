import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

function centeredAt(centerX: number, centerY: number, size: number) {
  return { top: centerY - size / 2, left: centerX - size / 2 };
}

// Two soft white glows fixed behind the screen content: one at dead
// center, one at the bottom-left corner, both capped at 0.1 opacity.
// Sized from this component's own measured layout (via onLayout) rather
// than the raw browser window, so it stays correctly positioned inside
// the centered phone-width column on wide desktop browsers, not just on
// an actual phone screen.
export default function GlowBackground() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  const glowSize = Math.max(size.width, size.height) * 0.55;

  return (
    <View style={StyleSheet.absoluteFill} onLayout={onLayout} pointerEvents="none">
      {glowSize > 0 ? (
        <>
          <Svg
            style={[styles.glow, centeredAt(size.width / 2, size.height / 2, glowSize)]}
            width={glowSize}
            height={glowSize}
          >
            <Defs>
              <RadialGradient id="glowCenter" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
                <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#glowCenter)" />
          </Svg>

          <Svg
            style={[styles.glow, centeredAt(0, size.height, glowSize)]}
            width={glowSize}
            height={glowSize}
          >
            <Defs>
              <RadialGradient id="glowBottomLeft" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.1} />
                <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#glowBottomLeft)" />
          </Svg>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
  },
});
