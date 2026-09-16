import { View, Text, StyleSheet } from 'react-native';
import { StageResult, PRICE_PER_PANEL, calculateStagePrice } from '../../utils/stageCalculator';
import { flat, neon } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';

interface StagePricingSectionProps {
  results: StageResult;
}

export default function StagePricingSection({ results }: StagePricingSectionProps) {
  const total = calculateStagePrice(results.totalPanels);

  return (
    <View>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Estimated total</Text>
        <Text style={styles.totalValue}>${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Rate</Text>
        <Text style={styles.rowValue}>${PRICE_PER_PANEL} / panel</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Total panels</Text>
        <Text style={styles.rowValue}>{results.totalPanels}</Text>
      </View>

      <Text style={styles.disclaimer}>Basic flat-rate estimate — excludes rigging, crew, delivery, and taxes.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  totalCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(52, 211, 153, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.18)',
    borderRadius: 12,
    paddingVertical: 20,
    marginBottom: 14,
  },
  totalLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: flat.textFaint,
  },
  totalValue: {
    fontFamily: fonts.bold,
    fontSize: 36,
    letterSpacing: -0.5,
    color: neon.mint,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: flat.border,
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textDim,
  },
  rowValue: {
    fontFamily: fonts.regular,
    fontSize: 13,
    fontWeight: '500',
    color: flat.text,
  },
  disclaimer: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: flat.textGhost,
    marginTop: 12,
    lineHeight: 14,
  },
});
