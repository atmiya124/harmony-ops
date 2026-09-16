import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { flat } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';

interface ResultCardProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: string | ReactNode;
  large?: boolean;
}

export default function ResultCard({ label, value, sub, color, icon, large }: ResultCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.accentLine, { backgroundColor: color }]} />
      {typeof icon === 'string' ? (
        <Text style={[styles.icon, { color }]}>{icon}</Text>
      ) : (
        <View style={styles.iconNode}>{icon}</View>
      )}
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, large && styles.valueLarge, { color }]}>{value}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: flat.surface,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 10,
    padding: 14,
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.5,
  },
  icon: {
    fontSize: 15,
    marginBottom: 8,
    opacity: 0.8,
  },
  iconNode: {
    marginBottom: 8,
    opacity: 0.8,
    alignItems: 'flex-start',
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1,
    color: flat.textFainter,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  value: {
    fontFamily: fonts.regular,
    fontSize: 15,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  valueLarge: {
    fontSize: 26,
    lineHeight: 30,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textGhost,
    marginTop: 4,
  },
});
