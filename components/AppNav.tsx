import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { fonts } from '../theme/theme';
import { neon } from '../theme/ledTheme';
import { CalcTab, EventsTab, Mode } from './navTypes';
import PlatformIcon from './icons/PlatformIcon';

const ICON_SIZE = 22;
const INACTIVE_COLOR = 'rgba(255,255,255,0.7)';
const SWITCH_ACCENT = neon.orange;

const CALC_TABS: { key: CalcTab; label: string }[] = [
  { key: 'led', label: 'Screen' },
  { key: 'stage', label: 'Stage' },
  { key: 'settings', label: 'Settings' },
];

const EVENTS_TABS: { key: EventsTab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'today', label: 'Today' },
  { key: 'settings', label: 'Settings' },
];

function TabIcon({ tab, mode, color }: { tab: string; mode: Mode; color: string }) {
  if (mode === 'calculator') {
    if (tab === 'led') return <Ionicons name="tv-outline" size={ICON_SIZE} color={color} />;
    if (tab === 'stage') return <PlatformIcon size={ICON_SIZE} color={color} />;
    return <Ionicons name="settings-outline" size={ICON_SIZE} color={color} />;
  }
  if (tab === 'home') return <Ionicons name="home-outline" size={ICON_SIZE} color={color} />;
  if (tab === 'bookings') return <Ionicons name="calendar-outline" size={ICON_SIZE} color={color} />;
  if (tab === 'today') return <Ionicons name="time-outline" size={ICON_SIZE} color={color} />;
  return <Ionicons name="settings-outline" size={ICON_SIZE} color={color} />;
}

interface AppNavProps {
  mode: Mode;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSwitchMode: () => void;
}

export default function AppNav({ mode, activeTab, onSelectTab, onSwitchMode }: AppNavProps) {
  const insets = useSafeAreaInsets();
  const tabs = mode === 'calculator' ? CALC_TABS : EVENTS_TABS;
  const switchLabel = mode === 'calculator' ? 'Events' : 'Calc';
  const switchIcon: keyof typeof Ionicons.glyphMap = mode === 'calculator' ? 'calendar-outline' : 'calculator-outline';

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
      <BlurView intensity={60} tint="dark" style={styles.pill}>
        <View style={styles.pillRow}>
          {tabs.map(({ key, label }) => {
            const isActive = key === activeTab;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => onSelectTab(key)}
                activeOpacity={0.75}
                accessibilityLabel={label}
                style={[styles.iconBadge, isActive && styles.iconBadgeActive]}
              >
                <TabIcon tab={key} mode={mode} color={isActive ? '#0a0a0a' : INACTIVE_COLOR} />
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>

      <TouchableOpacity onPress={onSwitchMode} activeOpacity={0.8} style={styles.switchShadow}>
        <BlurView intensity={60} tint="dark" style={styles.switchBtn}>
          <Ionicons name={switchIcon} size={19} color={SWITCH_ACCENT} />
          <Text style={styles.switchLabel}>{switchLabel}</Text>
        </BlurView>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  pill: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  switchShadow: {
    borderRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  switchBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(251, 146, 60, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.3)',
  },
  switchLabel: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.85)',
  },
});
