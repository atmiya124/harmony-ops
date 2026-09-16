import { View, Text, StyleSheet } from 'react-native';
import { LedWallResult } from '../../utils/ledCalculator';
import { flat, neon } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';

interface CablesSectionProps {
  results: LedWallResult;
}

export default function CablesSection({ results }: CablesSectionProps) {
  const powerRows = [
    { label: 'Main Power Cables', value: results.powerMainCables, note: '1 per 12 panels' },
    { label: 'Power Jump Cables', value: results.powerJumpCables, note: 'horizontal, within rows' },
    { label: 'Power Extension Cables', value: results.powerExtensionCables, note: 'vertical drops between rows' },
  ];
  const dataRows = [
    { label: 'Data Main Cables', value: results.dataMainCables, note: '1 per column' },
    { label: 'Data Jump Cables', value: results.dataJumpCables, note: 'vertical, within columns' },
  ];

  return (
    <View>
      <Text style={[styles.groupTitle, { color: neon.pink }]}>⚡ Power Cables</Text>
      <View style={styles.group}>
        {powerRows.map((row) => (
          <View
            key={row.label}
            style={[styles.row, { backgroundColor: 'rgba(244, 114, 182, 0.05)', borderColor: 'rgba(244, 114, 182, 0.12)' }]}
          >
            <View style={styles.rowTop}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={[styles.rowValue, { color: neon.pink }]}>{row.value}</Text>
            </View>
            <Text style={styles.rowNote}>{row.note}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.groupTitle, { color: neon.cyan, marginTop: 20 }]}>📡 Data Cables</Text>
      <View style={styles.group}>
        {dataRows.map((row) => (
          <View
            key={row.label}
            style={[styles.row, { backgroundColor: 'rgba(0, 212, 255, 0.05)', borderColor: 'rgba(0, 212, 255, 0.12)' }]}
          >
            <View style={styles.rowTop}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={[styles.rowValue, { color: neon.cyan }]}>{row.value}</Text>
            </View>
            <Text style={styles.rowNote}>{row.note}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  group: {
    gap: 8,
  },
  row: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textDim,
  },
  rowValue: {
    fontFamily: fonts.regular,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  rowNote: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: flat.textGhost,
    marginTop: 3,
  },
});
