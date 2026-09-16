import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import ResultCard from '../led/ResultCard';

interface CardConfig {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: string | ReactNode;
  large?: boolean;
}

interface ResultCardGridProps {
  cards: CardConfig[];
}

// Explicit non-wrapping row pairs rather than a `flexWrap` grid — RN's
// percentage/`100%` heights don't reliably participate in flex-line cross
// stretching on native (they render fine on web but blow up to fill the
// scroll container on device). A plain two-item row with `flex: 1` cells
// uses RN's default `alignItems: 'stretch'`, which reliably equalizes
// sibling heights on both platforms.
export default function ResultCardGrid({ cards }: ResultCardGridProps) {
  const rows: CardConfig[][] = [];
  for (let i = 0; i < cards.length; i += 2) {
    rows.push(cards.slice(i, i + 2));
  }

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((card) => (
            <View key={card.label} style={styles.cell}>
              <ResultCard {...card} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  cell: {
    flex: 1,
  },
});
