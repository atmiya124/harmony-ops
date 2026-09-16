import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../../theme/theme';
import { flat, neon } from '../../theme/ledTheme';
import { Booking, BookingStatus } from '../../utils/bookingTypes';
import BookingCard from './BookingCard';

type FilterTab = 'All' | 'Upcoming' | BookingStatus;

const FILTERS: FilterTab[] = ['All', 'Upcoming', 'Tentative', 'Confirmed', 'Completed', 'Cancelled'];

function daysUntil(dateStr: string): number {
  if (!dateStr) return -9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

interface Props {
  bookings: Booking[];
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function BookingsListScreen({ bookings, onSelect, onNew }: Props) {
  const [tab, setTab] = useState<FilterTab>('All');

  const nextEvent = useMemo(() => {
    return [...bookings]
      .filter((b) => b.eventDate && daysUntil(b.eventDate) >= 0 && b.status !== 'Cancelled')
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))[0];
  }, [bookings]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (tab === 'All') return true;
      if (tab === 'Upcoming') return daysUntil(b.eventDate) >= 0 && (b.status === 'Confirmed' || b.status === 'Tentative');
      return b.status === tab;
    });
  }, [bookings, tab]);

  return (
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

      {nextEvent && (
        <View style={styles.nextCard}>
          <View style={styles.nextHeader}>
            <Ionicons name="calendar" size={13} color={neon.cyan} />
            <Text style={styles.nextLabel}>Next up</Text>
          </View>
          <Text style={styles.nextTitle}>{nextEvent.eventTitle || 'Untitled event'}</Text>
          <Text style={styles.nextMeta}>
            {nextEvent.clientName} · {nextEvent.eventDate} · {nextEvent.venueName || 'No venue'}
          </Text>
        </View>
      )}

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} onPress={() => setTab(f)} style={[styles.filterChip, tab === f && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, tab === f && styles.filterChipTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ gap: 10 }}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={32} color={flat.textGhost} />
            <Text style={styles.emptyText}>No {tab === 'All' ? '' : tab.toLowerCase()} bookings</Text>
            <Text style={styles.emptySub}>Tap "New" to create one, or paste a client email to pre-fill it</Text>
          </View>
        ) : (
          filtered.map((b) => <BookingCard key={b.id} booking={b} onPress={() => onSelect(b.id)} />)
        )}
      </View>
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
    marginBottom: 16,
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: flat.surfaceInput,
    borderWidth: 1,
    borderColor: flat.border,
  },
  filterChipActive: {
    backgroundColor: flat.text,
    borderColor: flat.text,
  },
  filterChipText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
  },
  filterChipTextActive: {
    color: '#0a0a0a',
    fontFamily: fonts.bold,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
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
    paddingHorizontal: 24,
  },
});
