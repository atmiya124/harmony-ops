import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../../theme/theme';
import { flat, neon } from '../../theme/ledTheme';
import {
  ALL_SERVICES,
  Booking,
  EVENT_TYPES,
  STATUSES,
  STEP_LABELS,
  blankEquipmentItem,
} from '../../utils/bookingTypes';
import { EQUIPMENT_SUGGESTIONS, resolveEquipmentText } from '../../utils/equipmentCatalog';
import { AiParsedBooking } from '../../utils/aiParse';
import PasteEmailCard from './PasteEmailCard';

interface Props {
  initial: Booking;
  isEdit: boolean;
  onCancel: () => void;
  onSave: (booking: Booking) => void;
  onAiParsed?: (parsed: AiParsedBooking) => void;
}

export default function NewBookingScreen({ initial, isEdit, onCancel, onSave, onAiParsed }: Props) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Booking>(initial);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [ledWidth, setLedWidth] = useState('');
  const [ledHeight, setLedHeight] = useState('');

  const set = <K extends keyof Booking>(field: K, value: Booking[K]) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleService = (s: string) => {
    set('services', form.services.includes(s) ? form.services.filter((x) => x !== s) : [...form.services, s]);
  };

  const addEquipment = (name = '') => {
    set('equipment', [...form.equipment, { ...blankEquipmentItem(), itemName: name }]);
  };

  const updateEquipment = (index: number, field: 'itemName' | 'spec' | 'qty', value: string | number) => {
    set(
      'equipment',
      form.equipment.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const removeEquipment = (index: number) => {
    set('equipment', form.equipment.filter((_, i) => i !== index));
  };

  const addLedFromCalc = () => {
    const w = parseFloat(ledWidth);
    const h = parseFloat(ledHeight);
    if (!w || !h || w <= 0 || h <= 0) return;
    const resolved = resolveEquipmentText(`LED wall ${w}x${h}`, 1);
    set('equipment', [...form.equipment, { ...blankEquipmentItem(), itemName: resolved.itemName, spec: resolved.spec }]);
    setLedWidth('');
    setLedHeight('');
  };

  const next = () => setStep((s) => Math.min(5, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const handleSave = () => {
    onSave({ ...form, equipment: form.equipment.filter((e) => e.itemName.trim()) });
  };

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => (step > 1 ? back() : onCancel())} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={18} color={flat.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Booking' : 'New Booking'}</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.progressRow}>
        {STEP_LABELS.map((label, i) => (
          <View key={label} style={{ flex: 1 }}>
            <View style={[styles.progressBar, i + 1 <= step && styles.progressBarActive]} />
          </View>
        ))}
      </View>
      <View style={styles.progressLabels}>
        {STEP_LABELS.map((label, i) => (
          <Text key={label} style={[styles.progressLabel, i + 1 === step && styles.progressLabelActive]}>
            {label}
          </Text>
        ))}
      </View>

      {step === 1 && !isEdit && onAiParsed && (
        <View style={{ marginTop: 16 }}>
          <PasteEmailCard onParsed={onAiParsed} />
        </View>
      )}

      <View style={styles.stepBody}>
        {step === 1 && (
          <View style={{ gap: 14 }}>
            <StepHeader title="Event & Client Info" sub="Basic information about the event" />
            <Field label="Event Title" value={form.eventTitle} onChange={(v) => set('eventTitle', v)} placeholder="e.g. Martinez Quinceañera" />
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Client Contact</Text>
              <Field label="Client Name" value={form.clientName} onChange={(v) => set('clientName', v)} placeholder="Full name" />
              <Field label="Client Phone" value={form.clientPhone} onChange={(v) => set('clientPhone', v)} placeholder="(555) 234-5678" keyboardType="phone-pad" />
              <Field label="Client Email" value={form.clientEmail} onChange={(v) => set('clientEmail', v)} placeholder="client@example.com" keyboardType="email-address" />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 14 }}>
            <StepHeader title="Event Schedule" sub="Set up your event timeline" />
            <Field label="Event Date (YYYY-MM-DD)" value={form.eventDate} onChange={(v) => set('eventDate', v)} placeholder="2026-10-05" />
            <View style={styles.card}>
              <Field label="Setup Time (HH:MM)" value={form.setupTime} onChange={(v) => set('setupTime', v)} placeholder="09:00" />
              <Field label="Start Time (HH:MM)" value={form.startTime} onChange={(v) => set('startTime', v)} placeholder="18:00" />
              <Field label="End Time (HH:MM)" value={form.endTime} onChange={(v) => set('endTime', v)} placeholder="22:00" />
            </View>
            <View style={[styles.card, { borderColor: neon.orange + '30' }]}>
              <Text style={[styles.cardLabel, { color: neon.orange }]}>Pickup (optional)</Text>
              <Field label="Pickup Date" value={form.pickupDate} onChange={(v) => set('pickupDate', v)} placeholder="2026-10-06" />
              <Field label="Pickup Time" value={form.pickupTime} onChange={(v) => set('pickupTime', v)} placeholder="10:00" />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: 14 }}>
            <StepHeader title="Venue Details" sub="Where is the event taking place?" />
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Event Type</Text>
              <View style={styles.chipsRow}>
                {EVENT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => set('eventType', t)}
                    style={[styles.typeChip, form.eventType === t && styles.typeChipActive]}
                  >
                    <Text style={[styles.typeChipText, form.eventType === t && styles.typeChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Field label="Venue Name" value={form.venueName} onChange={(v) => set('venueName', v)} placeholder="Riverside Hall" />
            <Field label="Venue Address" value={form.venueAddress} onChange={(v) => set('venueAddress', v)} placeholder="123 Main St, City" />
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: 12 }}>
            <StepHeader title="Equipment List" sub="Add items with sizes and quantities" />

            {form.equipment.map((item, index) => (
              <View key={item.id} style={styles.eqRow}>
                <View style={styles.eqTop}>
                  <View style={styles.eqIndex}>
                    <Text style={styles.eqIndexText}>{index + 1}</Text>
                  </View>
                  <TextInput
                    value={item.itemName}
                    onChangeText={(v) => updateEquipment(index, 'itemName', v)}
                    placeholder="Item name"
                    placeholderTextColor={flat.textFaint}
                    style={styles.eqNameInput}
                  />
                  <TouchableOpacity onPress={() => removeEquipment(index)}>
                    <Ionicons name="trash-outline" size={16} color={flat.textFainter} />
                  </TouchableOpacity>
                </View>
                <View style={styles.eqBottom}>
                  <TextInput
                    value={item.spec || ''}
                    onChangeText={(v) => updateEquipment(index, 'spec', v)}
                    placeholder="Size / spec"
                    placeholderTextColor={flat.textFaint}
                    style={styles.eqSpecInput}
                  />
                  <TextInput
                    value={String(item.qty)}
                    onChangeText={(v) => updateEquipment(index, 'qty', parseInt(v) || 1)}
                    keyboardType="number-pad"
                    style={styles.eqQtyInput}
                  />
                </View>
              </View>
            ))}

            <View style={styles.ledCalcCard}>
              <Text style={styles.ledCalcTitle}>Quick-add LED wall</Text>
              <Text style={styles.ledCalcSub}>Enter feet — resolves against the panel catalog</Text>
              <View style={styles.ledRow}>
                <TextInput
                  value={ledWidth}
                  onChangeText={setLedWidth}
                  placeholder="Width"
                  placeholderTextColor={flat.textFaint}
                  keyboardType="decimal-pad"
                  style={styles.ledInput}
                />
                <Text style={styles.ledX}>×</Text>
                <TextInput
                  value={ledHeight}
                  onChangeText={setLedHeight}
                  placeholder="Height"
                  placeholderTextColor={flat.textFaint}
                  keyboardType="decimal-pad"
                  style={styles.ledInput}
                />
                <TouchableOpacity style={styles.ledAddBtn} onPress={addLedFromCalc}>
                  <Ionicons name="add" size={16} color="#0a0a0a" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.dashedBtn} onPress={() => addEquipment()}>
              <Ionicons name="add" size={16} color={flat.textDim} />
              <Text style={styles.dashedBtnText}>Add Equipment Item</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowSuggestions((v) => !v)}>
              <Text style={styles.suggestionsToggle}>{showSuggestions ? '▲ Hide suggestions' : '▼ Quick-add common items'}</Text>
            </TouchableOpacity>
            {showSuggestions && (
              <View style={styles.chipsRow}>
                {EQUIPMENT_SUGGESTIONS.map((s) => (
                  <TouchableOpacity key={s} style={styles.suggestionChip} onPress={() => addEquipment(s)}>
                    <Text style={styles.suggestionChipText}>+ {s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {step === 5 && (
          <View style={{ gap: 16 }}>
            <StepHeader title="Services & Notes" />
            <View>
              <Text style={styles.cardLabel}>Services</Text>
              <View style={styles.chipsRow}>
                {ALL_SERVICES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => toggleService(s)}
                    style={[styles.serviceChip, form.services.includes(s) && styles.serviceChipActive]}
                  >
                    {form.services.includes(s) && <Ionicons name="checkmark" size={12} color="#0a0a0a" />}
                    <Text style={[styles.serviceChipText, form.services.includes(s) && styles.serviceChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View>
              <Text style={styles.cardLabel}>Notes</Text>
              <TextInput
                value={form.notes}
                onChangeText={(v) => set('notes', v)}
                placeholder="Any special instructions..."
                placeholderTextColor={flat.textFaint}
                multiline
                numberOfLines={3}
                style={styles.notesInput}
              />
            </View>
            <View>
              <Text style={styles.cardLabel}>Status</Text>
              <View style={styles.chipsRow}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => set('status', s)}
                    style={[styles.statusChip, form.status === s && styles.statusChipActive]}
                  >
                    <Text style={[styles.statusChipText, form.status === s && styles.statusChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.navRow}>
        {step > 1 && (
          <TouchableOpacity style={styles.backButton} onPress={back}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}
        {step < 5 ? (
          <TouchableOpacity style={styles.nextButton} onPress={next}>
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="chevron-forward" size={15} color="#0a0a0a" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Ionicons name="checkmark" size={16} color="#0a0a0a" />
            <Text style={styles.saveButtonText}>{isEdit ? 'Save Changes' : 'Save Booking'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function StepHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <View>
      <Text style={styles.stepTitle}>{title}</Text>
      {sub ? <Text style={styles.stepSub}>{sub}</Text> : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={flat.textFaint}
        keyboardType={keyboardType}
        style={styles.fieldInput}
      />
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
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: flat.text,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: flat.border,
  },
  progressBarActive: {
    backgroundColor: neon.mint,
  },
  progressLabels: {
    flexDirection: 'row',
    marginTop: 6,
  },
  progressLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: flat.textFainter,
    textAlign: 'center',
  },
  progressLabelActive: {
    color: neon.mint,
    fontFamily: fonts.bold,
  },
  stepBody: {
    marginTop: 20,
  },
  stepTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: flat.text,
  },
  stepSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textFaint,
    marginTop: 2,
  },
  card: {
    backgroundColor: flat.surfaceAlt,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  cardLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: flat.textFaint,
    marginBottom: 4,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textDim,
  },
  fieldInput: {
    backgroundColor: flat.surfaceInput,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: flat.text,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: flat.border,
    backgroundColor: flat.surfaceInput,
  },
  typeChipActive: {
    backgroundColor: neon.cyan,
    borderColor: neon.cyan,
  },
  typeChipText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textDim,
  },
  typeChipTextActive: {
    color: '#0a0a0a',
    fontFamily: fonts.bold,
  },
  eqRow: {
    backgroundColor: flat.surfaceAlt,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  eqTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eqIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: neon.cyan + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eqIndexText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: neon.cyan,
  },
  eqNameInput: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: flat.text,
  },
  eqBottom: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 28,
  },
  eqSpecInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textDim,
    backgroundColor: flat.surfaceInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: flat.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  eqQtyInput: {
    width: 48,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 12,
    color: flat.text,
    backgroundColor: flat.surfaceInput,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: flat.border,
    paddingVertical: 8,
  },
  ledCalcCard: {
    backgroundColor: neon.orange + '0d',
    borderWidth: 1,
    borderColor: neon.orange + '30',
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  ledCalcTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: neon.orange,
  },
  ledCalcSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
    marginBottom: 8,
  },
  ledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ledInput: {
    flex: 1,
    backgroundColor: flat.surfaceInput,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: flat.text,
    textAlign: 'center',
  },
  ledX: {
    color: flat.textFaint,
    fontFamily: fonts.bold,
  },
  ledAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: neon.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: flat.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  dashedBtnText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: flat.textDim,
  },
  suggestionsToggle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: neon.cyan,
  },
  suggestionChip: {
    backgroundColor: flat.surfaceAlt,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionChipText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textDim,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: flat.border,
    backgroundColor: flat.surfaceInput,
    minWidth: '46%',
  },
  serviceChipActive: {
    backgroundColor: neon.mint,
    borderColor: neon.mint,
  },
  serviceChipText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textDim,
  },
  serviceChipTextActive: {
    color: '#0a0a0a',
    fontFamily: fonts.bold,
  },
  notesInput: {
    backgroundColor: flat.surfaceInput,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 10,
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: flat.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: flat.border,
    backgroundColor: flat.surfaceInput,
  },
  statusChipActive: {
    backgroundColor: neon.cyan,
    borderColor: neon.cyan,
  },
  statusChipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: flat.textDim,
  },
  statusChipTextActive: {
    color: '#0a0a0a',
  },
  navRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  backButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  backButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: flat.textDim,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: neon.cyan,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#0a0a0a',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: neon.green,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#0a0a0a',
  },
});
