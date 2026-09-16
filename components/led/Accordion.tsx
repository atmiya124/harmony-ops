import { ReactNode, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { flat } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AccordionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function Accordion({ title, subtitle, defaultOpen = false, children }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  }

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.header} onPress={toggle} activeOpacity={0.7}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && !open ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.chevron, open && styles.chevronOpen]}>
          <Ionicons name="chevron-down" size={16} color={flat.textFainter} />
        </View>
      </TouchableOpacity>
      {open ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: flat.surface,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontFamily: fonts.regular,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.3,
    color: flat.textFaint,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: flat.textFainter,
    marginTop: 4,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
});
