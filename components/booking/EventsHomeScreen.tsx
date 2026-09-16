import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../../theme/theme';
import { flat, neon } from '../../theme/ledTheme';
import { Booking, BookingStatus } from '../../utils/bookingTypes';
import BookingCard from './BookingCard';
import { statusColor } from './StatusBadge';

function daysUntil(dateStr: string): number {
  if (!dateStr) return -9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + 'T00:00:00').getTime() - today.getTime()) / 86400000);
}

interface Props {
  bookings: Booking[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onViewAll: () => void;
}

export default function EventsHomeScreen({ bookings, onSelect, onNew, onViewAll }: Props) {
  const nextEvent = useMemo(
    () =>
      [...bookings]
        .filter((b) => b.eventDate && daysUntil(b.eventDate) >= 0 && b.status !== 'Cancelled')
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0],
    [bookings],
  );

  const recent = useMemo(() => [...bookings].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3), [bookings]);

  const counts = useMemo(() => {
    const c: Record<BookingStatus, number> = { Tentative: 0, Confirmed: 0, Completed: 0, Cancelled: 0 };
    for (const b of bookings) c[b.status] += 1;
    return c;
  }, [bookings]);

  return (
    <View style={{ gap: 16, marginBottom: 16 }}>
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.sectionTitle}>Upcoming events</Text>
            <Text style={styles.headerSub}>{bookings.length} total bookings</Text>
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={onNew}>
            <Ionicons name="add" size={16} color="#0a0a0a" />
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {nextEvent ? (
          <TouchableOpacity style={styles.nextCard} onPress={() => onSelect(nextEvent.id)} activeOpacity={0.85}>
            <View style={styles.nextHeader}>
              <Ionicons name="calendar" size={13} color={neon.cyan} />
              <Text style={styles.nextLabel}>Next up</Text>
            </View>
            <Text style={styles.nextTitle}>{nextEvent.eventTitle || 'Untitled event'}</Text>
            <Text style={styles.nextMeta}>
              {nextEvent.clientName} · {nextEvent.eventDate} · {nextEvent.venueName || 'No venue'}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.emptyNext}>
            <Ionicons name="calendar-outline" size={24} color={flat.textGhost} />
            <Text style={styles.emptyNextText}>No upcoming bookings</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          {(Object.keys(counts) as BookingStatus[]).map((status) => (
            <View key={status} style={[styles.statCard, { borderColor: statusColor[status] + '30' }]}>
              <Text style={[styles.statValue, { color: statusColor[status] }]}>{counts[status]}</Text>
              <Text style={styles.statLabel}>{status}</Text>
            </View>
          ))}
        </View>
      </View>

      {recent.length > 0 && (
        <View style={styles.section}>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Recent</Text>
            <TouchableOpacity onPress={onViewAll}>
              <Text style={styles.viewAll}>View all</Text>
            </TouchableOpacity>
          </View>
          <View style={{ gap: 10 }}>
            {recent.map((b) => (
              <BookingCard key={b.id} booking={b} onPress={() => onSelect(b.id)} />
            ))}
          </View>
        </View>
      )}
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
    gap: 16,
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
  headerSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textFaint,
    marginTop: 2,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: neon.mint,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  newBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#0a0a0a',
  },
  nextCard: {
    backgroundColor: neon.cyan + '0d',
    borderWidth: 1,
    borderColor: neon.cyan + '30',
    borderRadius: 14,
    padding: 14,
  },
  nextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  nextLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: neon.cyan,
  },
  nextTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: flat.text,
  },
  nextMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textFaint,
    marginTop: 2,
  },
  emptyNext: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 20,
  },
  emptyNextText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textFaint,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    flexGrow: 1,
    minWidth: '22%',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: flat.surfaceAlt,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: flat.textFaint,
    marginTop: 2,
  },
  viewAll: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: neon.cyan,
  },
});
