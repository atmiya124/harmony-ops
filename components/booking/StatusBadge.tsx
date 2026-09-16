import { StyleSheet, Text, View } from 'react-native';
import { BookingStatus } from '../../utils/bookingTypes';
import { flat, neon } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';

export const statusColor: Record<BookingStatus, string> = {
  Tentative: neon.orange,
  Confirmed: neon.green,
  Completed: neon.cyan,
  Cancelled: neon.pink,
};

export default function StatusBadge({ status, large }: { status: BookingStatus; large?: boolean }) {
  const color = statusColor[status];
  return (
    <View
      style={[
        styles.badge,
        large && styles.badgeLarge,
        { backgroundColor: color + '1a', borderColor: color + '40' },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, large && styles.textLarge, { color }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  textLarge: {
    fontSize: 12,
  },
});

// Re-exported so screens that only need the raw dark-surface tokens don't
// have to import ledTheme directly.
export const bookingSurface = flat;
