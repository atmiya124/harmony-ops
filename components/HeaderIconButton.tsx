import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../theme/theme';

const SIZE = 42;
const RING_WIDTH = 1.5;
const ICON_SIZE = 20;

interface HeaderIconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  onPress?: () => void;
}

// Circular glass button: a diagonal gradient ring, bright at the top-right
// and bottom-left corners and dim in between, wrapped around a near-opaque
// fill so the highlight only shows as a thin lit border.
export default function HeaderIconButton({ icon, color = colors.text, onPress }: HeaderIconButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} hitSlop={10}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.55)']}
        locations={[0, 0.5, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.ring}
      >
        <View style={styles.inner}>
          <Ionicons name={icon} size={ICON_SIZE} color={color} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    padding: RING_WIDTH,
  },
  inner: {
    flex: 1,
    borderRadius: SIZE / 2,
    backgroundColor: 'rgba(5, 10, 20, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
