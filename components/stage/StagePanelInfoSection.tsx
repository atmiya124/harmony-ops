import { View, Text, StyleSheet } from 'react-native';
import { flat } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';

const ROWS: [string, string][] = [
  ['Platform size', '4 × 8 ft'],
  ['Legs / panel', '4'],
  ["8' support / panel", '2'],
  ["4' support / panel", '2'],
];

export default function StagePanelInfoSection() {
  return (
    <View>
      {ROWS.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textFainter,
  },
  value: {
    fontFamily: fonts.regular,
    fontSize: 12,
    fontWeight: '500',
    color: flat.textDim,
  },
});
