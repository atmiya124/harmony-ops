import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../../theme/theme';
import { flat, neon } from '../../theme/ledTheme';
import { AiParsedBooking } from '../../utils/aiParse';
import { Booking, EquipmentItem, blankBooking } from '../../utils/bookingTypes';

// Fields the app treats as required before a booking is usable — if the
// email didn't provide these, they land in the red "missing, required"
// group and block Confirm & Save until filled in.
const REQUIRED_FIELDS = ['clientName', 'eventDate', 'venueName', 'clientEmail'] as const;

const FIELD_LABELS: Record<string, string> = {
  eventTitle: 'Event title',
  clientName: 'Client name',
  clientPhone: 'Client phone',
  clientEmail: 'Client email',
  eventType: 'Event type',
  eventDate: 'Event date',
  setupTime: 'Setup time',
  startTime: 'Start time',
  endTime: 'End time',
  pickupDate: 'Pickup date',
  pickupTime: 'Pickup time',
  venueName: 'Venue name',
  venueAddress: 'Venue address',
  notes: 'Notes',
};

const SCALAR_FIELDS = Object.keys(FIELD_LABELS) as (keyof AiParsedBooking)[];

interface Props {
  parsed: AiParsedBooking;
  onCancel: () => void;
  onConfirm: (booking: Booking) => void;
}

export default function AiReviewScreen({ parsed, onCancel, onConfirm }: Props) {
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const key of SCALAR_FIELDS) initial[key] = (parsed[key] as string) || '';
    return initial;
  });
  const [services, setServices] = useState<string[]>(parsed.services || []);
  const [equipment, setEquipment] = useState<EquipmentItem[]>(
    (parsed.equipment || []).map((item) => ({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      itemName: item.itemName,
      spec: item.spec,
      qty: item.qty,
    })),
  );

  const setField = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  const groups = useMemo(() => {
    const auto: string[] = [];
    const review: string[] = [];
    const missingRequired: string[] = [];

    for (const key of SCALAR_FIELDS) {
      const confidence = parsed.meta?.[key]?.confidence ?? 'missing';
      const isRequired = (REQUIRED_FIELDS as readonly string[]).includes(key);
      const value = fields[key];

      if (!value.trim() && isRequired) {
        missingRequired.push(key);
      } else if (confidence === 'review') {
        review.push(key);
      } else if (confidence === 'auto' && value.trim()) {
        auto.push(key);
      } else if (!value.trim() && !isRequired) {
        // Not mentioned and not required — skip from the review lists;
        // stays editable in the underlying form later if needed.
      } else {
        auto.push(key);
      }
    }
    return { auto, review, missingRequired };
  }, [parsed.meta, fields]);

  const equipmentConfidence = parsed.meta?.equipment?.confidence ?? 'missing';
  const servicesConfidence = parsed.meta?.services?.confidence ?? 'missing';

  const canSave = groups.missingRequired.length === 0;

  const handleConfirm = () => {
    if (!canSave) return;
    const base = blankBooking();
    const booking: Booking = {
      ...base,
      eventTitle: fields.eventTitle || `${fields.clientName || 'Untitled'} – ${fields.eventType || 'Event'}`,
      clientName: fields.clientName,
      clientPhone: fields.clientPhone,
      clientEmail: fields.clientEmail,
      eventType: fields.eventType || 'Other',
      eventDate: fields.eventDate,
      setupTime: fields.setupTime,
      startTime: fields.startTime,
      endTime: fields.endTime,
      pickupDate: fields.pickupDate,
      pickupTime: fields.pickupTime,
      venueName: fields.venueName,
      venueAddress: fields.venueAddress,
      notes: fields.notes,
      status: 'Tentative',
      services,
      equipment,
    };
    onConfirm(booking);
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.sectionTitle}>AI review</Text>
          <Text style={styles.headerSub}>Check the extracted details before saving</Text>
        </View>
        <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={flat.textFaint} />
        </TouchableOpacity>
      </View>

      {groups.missingRequired.length > 0 && (
        <Tier
          color={neon.pink}
          icon="alert-circle"
          title="Missing — required"
          subtitle="The email didn't include these. Fill them in to save."
        >
          {groups.missingRequired.map((key) => (
            <FieldRow key={key} label={FIELD_LABELS[key]} value={fields[key]} onChange={(v) => setField(key, v)} color={neon.pink} />
          ))}
        </Tier>
      )}

      {groups.review.length > 0 && (
        <Tier color={neon.orange} icon="help-circle" title="Needs confirmation" subtitle="Assumed or ambiguous — please verify">
          {groups.review.map((key) => (
            <FieldRow
              key={key}
              label={FIELD_LABELS[key]}
              value={fields[key]}
              onChange={(v) => setField(key, v)}
              color={neon.orange}
              note={parsed.meta?.[key]?.note}
            />
          ))}
        </Tier>
      )}

      {(equipmentConfidence === 'review' || equipmentConfidence === 'missing') && equipment.length > 0 && (
        <Tier color={neon.orange} icon="help-circle" title="Equipment — verify specs" subtitle={parsed.meta?.equipment?.note}>
          <EquipmentList equipment={equipment} onChange={setEquipment} color={neon.orange} />
        </Tier>
      )}

      {groups.auto.length > 0 && (
        <Tier color={neon.green} icon="checkmark-circle" title="Auto-filled" subtitle="Extracted with confidence">
          {groups.auto.map((key) => (
            <FieldRow key={key} label={FIELD_LABELS[key]} value={fields[key]} onChange={(v) => setField(key, v)} color={neon.green} />
          ))}
        </Tier>
      )}

      {equipmentConfidence === 'auto' && equipment.length > 0 && (
        <Tier color={neon.green} icon="checkmark-circle" title="Equipment">
          <EquipmentList equipment={equipment} onChange={setEquipment} color={neon.green} />
        </Tier>
      )}

      {services.length > 0 && (
        <Tier color={servicesConfidence === 'auto' ? neon.green : neon.orange} icon="pricetags" title="Services">
          <View style={styles.chipsRow}>
            {services.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, { borderColor: neon.mint + '50', backgroundColor: neon.mint + '12' }]}
                onPress={() => setServices((prev) => prev.filter((x) => x !== s))}
              >
                <Text style={[styles.chipText, { color: neon.mint }]}>{s}</Text>
                <Ionicons name="close" size={12} color={neon.mint} />
              </TouchableOpacity>
            ))}
          </View>
        </Tier>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Discard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.confirmBtn, !canSave && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!canSave}
        >
          <Ionicons name="checkmark" size={16} color="#0a0a0a" />
          <Text style={styles.confirmText}>Confirm and save</Text>
        </TouchableOpacity>
      </View>
      {!canSave && (
        <Text style={styles.blockNote}>Fill in the required fields above (highlighted in red) to enable saving.</Text>
      )}
    </View>
  );
}

function Tier({
  color,
  icon,
  title,
  subtitle,
  children,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[tierStyles.card, { borderColor: color + '35', backgroundColor: color + '0d' }]}>
      <View style={tierStyles.header}>
        <Ionicons name={icon} size={15} color={color} />
        <Text style={[tierStyles.title, { color }]}>{title}</Text>
      </View>
      {subtitle ? <Text style={tierStyles.subtitle}>{subtitle}</Text> : null}
      <View style={{ gap: 8, marginTop: 8 }}>{children}</View>
    </View>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  color,
  note,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
  note?: string;
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="—"
        placeholderTextColor={flat.textFaint}
        style={[rowStyles.input, { borderColor: color + '40' }]}
      />
      {note ? <Text style={rowStyles.note}>{note}</Text> : null}
    </View>
  );
}

function EquipmentList({
  equipment,
  onChange,
  color,
}: {
  equipment: EquipmentItem[];
  onChange: (items: EquipmentItem[]) => void;
  color: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {equipment.map((item, i) => (
        <View key={item.id} style={[eqStyles.row, { borderColor: color + '30' }]}>
          <TextInput
            value={item.itemName}
            onChangeText={(v) => onChange(equipment.map((e, idx) => (idx === i ? { ...e, itemName: v } : e)))}
            style={eqStyles.name}
            placeholderTextColor={flat.textFaint}
          />
          <TextInput
            value={item.spec}
            onChangeText={(v) => onChange(equipment.map((e, idx) => (idx === i ? { ...e, spec: v } : e)))}
            style={eqStyles.spec}
            placeholder="spec"
            placeholderTextColor={flat.textFaint}
          />
          <TextInput
            value={String(item.qty)}
            onChangeText={(v) => onChange(equipment.map((e, idx) => (idx === i ? { ...e, qty: parseInt(v) || 1 } : e)))}
            keyboardType="number-pad"
            style={eqStyles.qty}
          />
        </View>
      ))}
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
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  closeBtn: {
    padding: 4,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: flat.textDim,
  },
  confirmBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: neon.green,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#0a0a0a',
  },
  blockNote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: neon.pink,
    textAlign: 'center',
  },
});

const tierStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
    marginTop: 4,
  },
});

const rowStyles = StyleSheet.create({
  row: {
    gap: 4,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: flat.surfaceInput,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: flat.text,
  },
  note: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: flat.textFaint,
    fontStyle: 'italic',
  },
});

const eqStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  name: {
    flex: 1.4,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.text,
  },
  spec: {
    flex: 1.4,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textDim,
  },
  qty: {
    width: 36,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 12,
    color: flat.text,
  },
});
