import { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { flat } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';

interface DimensionInputProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  unit: string;
  icon?: string;
}

export default function DimensionInput({ label, value, onChangeText, unit, icon }: DimensionInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      <Text style={styles.label}>
        {icon ? `${icon} ` : ''}
        {label}
      </Text>
      <View style={[styles.row, focused && styles.rowFocused]}>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={onChangeText}
          placeholder="0"
          placeholderTextColor={flat.textGhost}
          selectTextOnFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <View style={styles.unitBox}>
          <Text style={styles.unitText}>{unit}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.regular,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    color: flat.textFainter,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: flat.surfaceInput,
    borderWidth: 1,
    borderColor: flat.borderStrong,
    borderRadius: 8,
    overflow: 'hidden',
  },
  rowFocused: {
    borderColor: 'rgba(0, 212, 255, 0.5)',
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 20,
    color: flat.text,
    letterSpacing: -0.3,
  },
  unitBox: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: flat.border,
  },
  unitText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    fontWeight: '500',
    color: flat.textGhost,
    letterSpacing: 0.5,
  },
});
