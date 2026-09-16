import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../../theme/theme';
import { flat, neon } from '../../theme/ledTheme';
import { Booking, BookingStatus, blankBooking } from '../../utils/bookingTypes';
import { deleteBooking, listBookings, saveBooking } from '../../utils/bookingStorage';
import { AiParsedBooking } from '../../utils/aiParse';
import { EventsTab } from '../navTypes';
import EventsHomeScreen from './EventsHomeScreen';
import EventsTodayScreen from './EventsTodayScreen';
import BookingsListScreen from './BookingsListScreen';
import NewBookingScreen from './NewBookingScreen';
import BookingDetailScreen from './BookingDetailScreen';
import AiReviewScreen from './AiReviewScreen';

type SubView =
  | { mode: 'tabs' }
  | { mode: 'detail'; id: string }
  | { mode: 'new' }
  | { mode: 'edit'; id: string }
  | { mode: 'review'; parsed: AiParsedBooking };

interface EventsRootProps {
  eventsTab: EventsTab;
  navTapCount: number;
  onGoToBookings: () => void;
}

export default function EventsRoot({ eventsTab, navTapCount, onGoToBookings }: EventsRootProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [subView, setSubView] = useState<SubView>({ mode: 'tabs' });

  const reload = useCallback(async () => {
    const data = await listBookings();
    setBookings(data);
  }, []);

  // Tapping a bottom-tab (including re-tapping the active one) while a
  // detail/new/edit/review sub-screen is open should pop back to that tab's
  // root, like a standard tab bar.
  useEffect(() => {
    setSubView({ mode: 'tabs' });
  }, [navTapCount]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const handleSave = async (booking: Booking) => {
    await saveBooking(booking);
    await reload();
    setSubView({ mode: 'detail', id: booking.id });
  };

  const handleDelete = async (id: string) => {
    await deleteBooking(id);
    await reload();
    setSubView({ mode: 'tabs' });
  };

  const handleStatusChange = async (booking: Booking, status: BookingStatus) => {
    await saveBooking({ ...booking, status });
    await reload();
  };

  if (loading) {
    return (
      <View style={{ paddingVertical: 60, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={neon.cyan} />
      </View>
    );
  }

  if (subView.mode === 'new') {
    return (
      <NewBookingScreen
        initial={blankBooking()}
        isEdit={false}
        onCancel={() => setSubView({ mode: 'tabs' })}
        onSave={handleSave}
        onAiParsed={(parsed) => setSubView({ mode: 'review', parsed })}
      />
    );
  }

  if (subView.mode === 'edit') {
    const booking = bookings.find((b) => b.id === subView.id);
    if (!booking) {
      setSubView({ mode: 'tabs' });
      return null;
    }
    return (
      <NewBookingScreen initial={booking} isEdit onCancel={() => setSubView({ mode: 'detail', id: booking.id })} onSave={handleSave} />
    );
  }

  if (subView.mode === 'review') {
    return <AiReviewScreen parsed={subView.parsed} onCancel={() => setSubView({ mode: 'new' })} onConfirm={handleSave} />;
  }

  if (subView.mode === 'detail') {
    const booking = bookings.find((b) => b.id === subView.id);
    if (!booking) {
      setSubView({ mode: 'tabs' });
      return null;
    }
    return (
      <BookingDetailScreen
        booking={booking}
        onBack={() => setSubView({ mode: 'tabs' })}
        onEdit={() => setSubView({ mode: 'edit', id: booking.id })}
        onDelete={() => handleDelete(booking.id)}
        onStatusChange={(status) => handleStatusChange(booking, status)}
      />
    );
  }

  const openDetail = (id: string) => setSubView({ mode: 'detail', id });
  const openNew = () => setSubView({ mode: 'new' });

  if (eventsTab === 'home') {
    return <EventsHomeScreen bookings={bookings} onSelect={openDetail} onNew={openNew} onViewAll={onGoToBookings} />;
  }
  if (eventsTab === 'today') {
    return <EventsTodayScreen bookings={bookings} onSelect={openDetail} />;
  }
  if (eventsTab === 'settings') {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="settings-outline" size={32} color={flat.textGhost} />
        <Text style={styles.placeholderText}>Settings coming soon</Text>
      </View>
    );
  }
  return <BookingsListScreen bookings={bookings} onSelect={openDetail} onNew={openNew} />;
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
    gap: 12,
  },
  placeholderText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: flat.textGhost,
  },
});
