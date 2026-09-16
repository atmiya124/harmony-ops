import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { ASPECT_PRESETS, AspectPreset } from '../../utils/ledCalculator';
import { flat, neon } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';

interface AspectRatioSectionProps {
  lockedRatio: AspectPreset | null;
  onApplyPreset: (preset: AspectPreset) => void;
  customW: string;
  customH: string;
  onChangeCustomW: (v: string) => void;
  onChangeCustomH: (v: string) => void;
  onApplyCustom: () => void;
  onUnlock: () => void;
}

const BOX_W = 28;
const BOX_H = 16;

function ratioBoxSize(w: number, h: number) {
  const ratio = w / h;
  const containerRatio = BOX_W / BOX_H;
  if (ratio >= containerRatio) {
    return { width: BOX_W, height: BOX_W / ratio };
  }
  return { width: BOX_H * ratio, height: BOX_H };
}

export default function AspectRatioSection({
  lockedRatio,
  onApplyPreset,
  customW,
  customH,
  onChangeCustomW,
  onChangeCustomH,
  onApplyCustom,
  onUnlock,
}: AspectRatioSectionProps) {
  const [focusedField, setFocusedField] = useState<'w' | 'h' | null>(null);

  return (
    <View>
      <View style={styles.presetGrid}>
        {ASPECT_PRESETS.map((preset) => {
          const isActive = lockedRatio?.label === preset.label;
          const box = ratioBoxSize(preset.w, preset.h);
          return (
            <TouchableOpacity
              key={preset.label}
              style={[styles.presetButton, isActive && styles.presetButtonActive]}
              onPress={() => onApplyPreset(preset)}
            >
              <View style={styles.ratioBoxOuter}>
                <View
                  style={[
                    styles.ratioBoxInner,
                    { width: box.width, height: box.height, borderColor: isActive ? neon.cyan : flat.borderStrong },
                  ]}
                />
              </View>
              <Text style={[styles.presetLabel, isActive && styles.presetLabelActive]}>{preset.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.customLabel}>Custom ratio</Text>
      <View style={styles.customRow}>
        <TextInput
          style={[styles.customInput, focusedField === 'w' && styles.customInputFocused]}
          keyboardType="decimal-pad"
          value={customW}
          onChangeText={onChangeCustomW}
          textAlign="center"
          selectTextOnFocus
          onFocus={() => setFocusedField('w')}
          onBlur={() => setFocusedField(null)}
        />
        <Text style={styles.customColon}>:</Text>
        <TextInput
          style={[styles.customInput, focusedField === 'h' && styles.customInputFocused]}
          keyboardType="decimal-pad"
          value={customH}
          onChangeText={onChangeCustomH}
          textAlign="center"
          selectTextOnFocus
          onFocus={() => setFocusedField('h')}
          onBlur={() => setFocusedField(null)}
        />
        <TouchableOpacity style={styles.applyButton} onPress={onApplyCustom}>
          <Text style={styles.applyButtonText}>Apply</Text>
        </TouchableOpacity>
      </View>

      {lockedRatio ? (
        <TouchableOpacity style={styles.unlockButton} onPress={onUnlock}>
          <Text style={styles.unlockButtonText}>Unlock ratio — edit freely</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetButton: {
    width: '31%',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: flat.border,
    backgroundColor: flat.surfaceAlt,
    alignItems: 'center',
    gap: 4,
  },
  presetButtonActive: {
    borderColor: 'rgba(0, 212, 255, 0.5)',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  ratioBoxOuter: {
    width: BOX_W,
    height: BOX_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratioBoxInner: {
    borderWidth: 1,
    borderRadius: 2,
  },
  presetLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    fontWeight: '500',
    color: flat.textDim,
  },
  presetLabelActive: {
    color: neon.cyan,
  },
  customLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
    color: flat.textFainter,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.regular,
    backgroundColor: flat.surfaceInput,
    borderWidth: 1,
    borderColor: flat.borderStrong,
    borderRadius: 6,
    paddingLeft: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: flat.text,
  },
  customInputFocused: {
    borderColor: 'rgba(0, 212, 255, 0.5)',
  },
  customColon: {
    fontFamily: fonts.regular,
    color: flat.textFainter,
    fontSize: 18,
    fontWeight: '300',
  },
  applyButton: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 212, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.25)',
  },
  applyButtonText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    fontWeight: '600',
    color: neon.cyan,
  },
  unlockButton: {
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: flat.border,
    alignItems: 'center',
  },
  unlockButtonText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFainter,
  },
});
