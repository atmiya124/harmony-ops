import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../../theme/theme';
import { flat, neon } from '../../theme/ledTheme';
import { Booking } from '../../utils/bookingTypes';
import StatusBadge from './StatusBadge';

function to12hr(time: string): string {
  if (!time) return '—';
  try {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch {
    return time;
  }
}

interface Props {
  bookings: Booking[];
  onSelect: (id: string) => void;
}

export default function EventsTodayScreen({ bookings, onSelect }: Props) {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todays = useMemo(() => bookings.filter((b) => b.eventDate === todayStr), [bookings, todayStr]);

  const upcoming = useMemo(
    () =>
      [...bookings]
        .filter((b) => b.eventDate && b.eventDate > todayStr)
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
        .slice(0, 5),
    [bookings, todayStr],
  );

  return (
    <View style={{ gap: 16, marginBottom: 16 }}>
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Operations board</Text>
          <View style={styles.dateChip}>
            <Ionicons name="today-outline" size={12} color={neon.orange} />
            <Text style={styles.dateChipText}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </View>

        {todays.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-outline" size={26} color={flat.textGhost} />
            <Text style={styles.emptyText}>No scheduled events today</Text>
            <Text style={styles.emptySub}>Active setups, pickup windows, and reminders will show up here.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {todays.map((event) => (
              <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => onSelect(event.id)} activeOpacity={0.85}>
                <View style={styles.eventTop}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {event.eventTitle || 'Untitled event'}
                  </Text>
                  <StatusBadge status={event.status} />
                </View>
                <Row icon="time-outline" text={`Setup ${to12hr(event.setupTime)} · Live ${to12hr(event.startTime)}–${to12hr(event.endTime)}`} />
                {event.venueName ? <Row icon="location-outline" text={event.venueName} /> : null}
                {(event.pickupDate || event.pickupTime) ? (
                  <Row icon="car-outline" text={`Pickup ${to12hr(event.pickupTime)}`} />
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {upcoming.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming up</Text>
          <View style={{ gap: 8 }}>
            {upcoming.map((event) => (
              <TouchableOpacity key={event.id} style={styles.upcomingRow} onPress={() => onSelect(event.id)} activeOpacity={0.85}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.upcomingTitle} numberOfLines={1}>
                    {event.eventTitle || 'Untitled event'}
                  </Text>
                  <Text style={styles.upcomingMeta} numberOfLines={1}>
                    {event.eventDate} · {event.venueName || 'No venue'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={flat.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={13} color={neon.orange} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: flat.surface,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 12,
    padding: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: flat.text,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: neon.orange + '15',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dateChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: neon.orange,
  },
  empty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 24,
  },
  emptyText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: flat.textDim,
  },
  emptySub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  eventCard: {
    backgroundColor: flat.surfaceAlt,
    borderWidth: 1,
    borderColor: neon.orange + '30',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eventTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: flat.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textDim,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: flat.surfaceAlt,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 12,
    padding: 12,
  },
  upcomingTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: flat.text,
  },
  upcomingMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
    marginTop: 2,
  },
});
