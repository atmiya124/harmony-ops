import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Booking } from '../../utils/bookingTypes';
import { flat, neon } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';
import StatusBadge from './StatusBadge';

function formatDate(dateStr: string): string {
  if (!dateStr) return 'No date';
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function BookingCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.row}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={1}>
            {booking.eventTitle || 'Untitled event'}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {booking.clientName || 'No client name'} · {formatDate(booking.eventDate)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={flat.textFaint} />
      </View>
      <View style={styles.metaRow}>
        <StatusBadge status={booking.status} />
        {booking.venueName ? (
          <View style={styles.venueChip}>
            <Ionicons name="location-outline" size={12} color={neon.cyan} />
            <Text style={styles.venueChipText} numberOfLines={1}>
              {booking.venueName}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: flat.surface,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: flat.text,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textFaint,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  venueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 180,
  },
  venueChipText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textDim,
  },
});
