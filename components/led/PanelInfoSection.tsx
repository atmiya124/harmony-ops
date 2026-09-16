import { View, Text, StyleSheet } from 'react-native';
import { flat } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';

const ROWS: [string, string][] = [
  ['Module size', '500 × 500 mm'],
  ['Resolution', '192 × 192 px'],
  ['Pixel pitch', '2.604 mm'],
  ['Power / panel', '200 W'],
  ['Max brightness', '1,300 nits'],
  ['Flight box', '8 panels / box'],
];

export default function PanelInfoSection() {
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
