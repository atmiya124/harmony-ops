import { useState } from 'react';
import { View, Text, Share, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { colors, fonts } from '../theme/theme';
import { neon } from '../theme/ledTheme';
import HeaderIconButton from './HeaderIconButton';

const HEADER_HEIGHT = 56;

interface HeaderProps {
  title: string;
  getSummaryText: () => string;
}

export default function Header({ title, getSummaryText }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = getSummaryText();
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    const text = getSummaryText();
    if (!text) return;
    await Share.share({ message: text });
  }

  return (
    <View style={[styles.wrapper, { height: HEADER_HEIGHT + insets.top }]}>
      {/* Blurs whatever scrolls up behind the header, like the floating menu */}
      <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
      {/* Fades that blurred backdrop from fully opaque at the top to fully
          transparent at the bottom, so the header dissolves into the
          content instead of ending on a hard edge */}
      <LinearGradient
        colors={[colors.background, `${colors.background}00`]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingTop: insets.top }]}>
        <HeaderIconButton
          icon={copied ? 'checkmark' : 'copy-outline'}
          color={copied ? neon.green : colors.text}
          onPress={handleCopy}
        />

        <Text style={styles.title}>{title}</Text>

        <HeaderIconButton icon="share-outline" onPress={handleShare} />
      </View>
    </View>
  );
}

export { HEADER_HEIGHT };

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
  },
});
