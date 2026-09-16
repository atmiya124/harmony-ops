import { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../../theme/theme';
import { flat, neon } from '../../theme/ledTheme';
import { Booking, BookingStatus, STATUSES } from '../../utils/bookingTypes';
import StatusBadge, { statusColor } from './StatusBadge';

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

function formatDate(dateStr: string): string {
  if (!dateStr) return 'No date set';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

interface Props {
  booking: Booking;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: BookingStatus) => void;
}

export default function BookingDetailScreen({ booking, onBack, onEdit, onDelete, onStatusChange }: Props) {
  const accent = statusColor[booking.status];
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <View style={styles.section}>
      <View style={[styles.headerBand, { backgroundColor: accent + '14', borderColor: accent + '35' }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={flat.text} />
        </TouchableOpacity>
        <Text style={styles.eventType}>{booking.eventType}</Text>
        <Text style={styles.eventTitle}>{booking.eventTitle || 'Untitled event'}</Text>
        <View style={{ marginTop: 8 }}>
          <StatusBadge status={booking.status} large />
        </View>
      </View>

      {/* Event details */}
      <Card title="Event Details">
        <DetailRow icon="calendar-outline" color={neon.cyan} text={formatDate(booking.eventDate)} />
        <DetailRow
          icon="time-outline"
          color={neon.purple}
          text={`Setup ${to12hr(booking.setupTime)} · Start ${to12hr(booking.startTime)} · End ${to12hr(booking.endTime)}`}
        />
        {Boolean(booking.pickupDate || booking.pickupTime) && (
          <DetailRow icon="car-outline" color={neon.orange} text={`Pickup ${booking.pickupDate ? formatDate(booking.pickupDate) + ' ' : ''}${to12hr(booking.pickupTime)}`} />
        )}
        <DetailRow icon="location-outline" color={neon.pink} text={booking.venueName} sub={booking.venueAddress} />

        {booking.services.length > 0 && (
          <View style={styles.chipsRow}>
            {booking.services.map((s) => (
              <View key={s} style={styles.serviceChip}>
                <Text style={styles.serviceChipText}>{s}</Text>
              </View>
            ))}
          </View>
        )}

        {booking.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{booking.notes}</Text>
          </View>
        ) : null}
      </Card>

      {/* Equipment */}
      {booking.equipment.length > 0 && (
        <Card title="Equipment" badge={`${booking.equipment.length} items`}>
          {booking.equipment.map((item, i) => (
            <View key={item.id} style={[styles.eqRow, i === booking.equipment.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.eqName} numberOfLines={1}>
                  {item.itemName}
                </Text>
                {item.spec ? (
                  <Text style={styles.eqSpec} numberOfLines={2}>
                    {item.spec}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.eqQty}>×{item.qty}</Text>
            </View>
          ))}
        </Card>
      )}

      {/* Client */}
      <Card title="Client">
        <Text style={styles.clientName}>{booking.clientName || 'No client name'}</Text>
        <View style={styles.actionRow}>
          <ActionButton
            icon="call"
            label="Call"
            color={neon.green}
            disabled={!booking.clientPhone}
            onPress={() => Linking.openURL(`tel:${booking.clientPhone}`)}
          />
          <ActionButton
            icon="navigate"
            label="Maps"
            color={neon.cyan}
            disabled={!booking.venueAddress}
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(booking.venueAddress)}`)}
          />
          <ActionButton
            icon="mail"
            label="Email"
            color={neon.purple}
            disabled={!booking.clientEmail}
            onPress={() => Linking.openURL(`mailto:${booking.clientEmail}`)}
          />
        </View>
      </Card>

      {/* Actions */}
      <Card title="Actions">
        <Text style={styles.statusLabel}>Change status</Text>
        <View style={styles.statusGrid}>
          {STATUSES.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => onStatusChange(s)}
              style={[
                styles.statusOption,
                booking.status === s && { backgroundColor: statusColor[s], borderColor: statusColor[s] },
              ]}
            >
              <Text style={[styles.statusOptionText, booking.status === s && { color: '#0a0a0a' }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
          <Ionicons name="create-outline" size={16} color="#0a0a0a" />
          <Text style={styles.editBtnText}>Edit Booking</Text>
        </TouchableOpacity>

        {confirmingDelete ? (
          <View style={styles.confirmRow}>
            <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmingDelete(false)}>
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmDeleteBtn} onPress={onDelete}>
              <Text style={styles.confirmDeleteText}>Confirm delete</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => setConfirmingDelete(true)}>
            <Ionicons name="trash-outline" size={16} color={neon.pink} />
            <Text style={styles.deleteBtnText}>Delete Booking</Text>
          </TouchableOpacity>
        )}
      </Card>
    </View>
  );
}

function Card({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {badge ? <Text style={styles.cardBadge}>{badge}</Text> : null}
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function DetailRow({ icon, color, text, sub }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string; sub?: string }) {
  if (!text) return null;
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailText}>{text}</Text>
        {sub ? <Text style={styles.detailSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  color,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: disabled ? flat.surfaceInput : color }]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={17} color={disabled ? flat.textFainter : '#0a0a0a'} />
      <Text style={[styles.actionBtnText, { color: disabled ? flat.textFainter : '#0a0a0a' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
    marginBottom: 16,
  },
  headerBand: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  backBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  eventType: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: flat.textFaint,
  },
  eventTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: flat.text,
    marginTop: 4,
  },
  card: {
    backgroundColor: flat.surface,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: flat.textFaint,
  },
  cardBadge: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
    backgroundColor: flat.surfaceInput,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: flat.text,
  },
  detailSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
    marginTop: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  serviceChip: {
    backgroundColor: neon.mint + '15',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  serviceChipText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: neon.mint,
  },
  notesBox: {
    backgroundColor: neon.orange + '10',
    borderWidth: 1,
    borderColor: neon.orange + '30',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  notesLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: neon.orange,
    marginBottom: 2,
  },
  notesText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textDim,
    lineHeight: 17,
  },
  eqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: flat.border,
  },
  eqName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: flat.text,
  },
  eqSpec: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
    marginTop: 2,
  },
  eqQty: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: neon.cyan,
  },
  clientName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: flat.text,
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  statusLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
    marginBottom: 8,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statusOption: {
    flexGrow: 1,
    minWidth: '46%',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: flat.border,
    backgroundColor: flat.surfaceInput,
  },
  statusOptionText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: flat.textDim,
  },
  editBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: neon.cyan,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 10,
  },
  editBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#0a0a0a',
  },
  deleteBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: neon.pink + '40',
    borderRadius: 12,
    paddingVertical: 13,
  },
  deleteBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: neon.pink,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: flat.border,
  },
  confirmCancelText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: flat.textDim,
  },
  confirmDeleteBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: neon.pink,
  },
  confirmDeleteText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#0a0a0a',
  },
});
