import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { flat } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';

interface QuickSizeChipsProps<T extends { label: string }> {
  items: readonly T[];
  onSelect: (item: T) => void;
}

export default function QuickSizeChips<T extends { label: string }>({
  items,
  onSelect,
}: QuickSizeChipsProps<T>) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <TouchableOpacity key={item.label} style={styles.chip} onPress={() => onSelect(item)}>
          <Text style={styles.chipText}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: flat.surfaceInput,
    borderWidth: 1,
    borderColor: flat.borderStrong,
  },
  chipText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    fontWeight: '500',
    color: flat.textDim,
  },
});
