import { useCallback, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from '@expo-google-fonts/roboto/useFonts';
import { Roboto_400Regular } from '@expo-google-fonts/roboto/400Regular';
import { Roboto_700Bold } from '@expo-google-fonts/roboto/700Bold';
import * as SplashScreen from 'expo-splash-screen';

import Header, { HEADER_HEIGHT } from './components/Header';
import GlowBackground from './components/GlowBackground';
import AppNav from './components/AppNav';
import { CalcTab, EventsTab, Mode } from './components/navTypes';
import Ionicons from '@expo/vector-icons/Ionicons';
import QuickSizeChips from './components/shared/QuickSizeChips';
import DimensionInput from './components/led/DimensionInput';
import AspectRatioSection from './components/led/AspectRatioSection';
import PanelInfoSection from './components/led/PanelInfoSection';
import Accordion from './components/led/Accordion';
import WallPreviewGrid from './components/led/WallPreviewGrid';
import ResultCardGrid from './components/shared/ResultCardGrid';
import CablesSection from './components/led/CablesSection';
import PricingSection from './components/led/PricingSection';
import StageCalculatorScreen from './components/stage/StageCalculatorScreen';
import EventsRoot from './components/booking/EventsRoot';
import {
  calculateLedWall,
  calculateLedPrice,
  mmToUnit,
  unitToMm,
  fmt,
  AspectPreset,
  QUICK_SIZES,
  Unit,
} from './utils/ledCalculator';
import { colors, fonts, space } from './theme/theme';
import { flat, neon } from './theme/ledTheme';

SplashScreen.preventAutoHideAsync();

// Extra scroll room so content can clear the floating menu instead of
// permanently hiding behind it.
const FLOATING_MENU_SPACE = 96;

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const [mode, setMode] = useState<Mode>('calculator');
  const [calcTab, setCalcTab] = useState<CalcTab>('led');
  const [eventsTab, setEventsTab] = useState<EventsTab>('home');
  // Increments on every bottom-tab tap (even re-tapping the active tab), so
  // EventsRoot can pop back to that tab's root like a standard tab bar.
  const [navTapCount, setNavTapCount] = useState(0);
  const [unit, setUnit] = useState<Unit>('ft');
  const [widthInput, setWidthInput] = useState('20');
  const [heightInput, setHeightInput] = useState('10');
  const [lockedRatio, setLockedRatio] = useState<AspectPreset | null>(null);
  const [customW, setCustomW] = useState('16');
  const [customH, setCustomH] = useState('9');

  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const widthVal = parseFloat(widthInput) || 0;
  const heightVal = parseFloat(heightInput) || 0;
  const isValid = widthVal > 0 && heightVal > 0;

  const result = useMemo(
    () => calculateLedWall(widthVal, heightVal, unit),
    [widthVal, heightVal, unit]
  );

  const handleWidthChange = useCallback(
    (v: string) => {
      setWidthInput(v);
      if (lockedRatio) {
        const w = parseFloat(v) || 0;
        const h = (w * lockedRatio.h) / lockedRatio.w;
        setHeightInput(fmt(h));
      }
    },
    [lockedRatio]
  );

  const handleHeightChange = useCallback(
    (v: string) => {
      setHeightInput(v);
      if (lockedRatio) {
        const h = parseFloat(v) || 0;
        const w = (h * lockedRatio.w) / lockedRatio.h;
        setWidthInput(fmt(w));
      }
    },
    [lockedRatio]
  );

  const applyQuickSize = useCallback((q: (typeof QUICK_SIZES)[number]) => {
    setUnit(q.u);
    setWidthInput(String(q.w));
    setHeightInput(String(q.h));
    setLockedRatio(null);
  }, []);

  const applyPreset = useCallback(
    (preset: AspectPreset) => {
      if (lockedRatio?.label === preset.label) {
        setLockedRatio(null);
        return;
      }
      setLockedRatio(preset);
      const w = parseFloat(widthInput) || 0;
      if (w > 0) {
        setHeightInput(fmt((w * preset.h) / preset.w));
      }
    },
    [lockedRatio, widthInput]
  );

  const applyCustomRatio = useCallback(() => {
    const cw = parseFloat(customW) || 0;
    const ch = parseFloat(customH) || 0;
    if (cw <= 0 || ch <= 0) return;
    const preset: AspectPreset = { label: `${customW}:${customH}`, w: cw, h: ch };
    setLockedRatio(preset);
    const w = parseFloat(widthInput) || 0;
    if (w > 0) {
      setHeightInput(fmt((w * ch) / cw));
    }
  }, [customW, customH, widthInput]);

  const unlockRatio = useCallback(() => setLockedRatio(null), []);

  const handleUnitChange = useCallback(
    (newUnit: Unit) => {
      const wMm = unitToMm(parseFloat(widthInput) || 0, unit);
      const hMm = unitToMm(parseFloat(heightInput) || 0, unit);
      setWidthInput(fmt(mmToUnit(wMm, newUnit)));
      setHeightInput(fmt(mmToUnit(hMm, newUnit)));
      setUnit(newUnit);
    },
    [unit, widthInput, heightInput]
  );

  const getSummaryText = useCallback(() => {
    if (mode !== 'calculator' || calcTab !== 'led' || !result) return '';
    return [
      `Screen dimensions: ${result.actualWidthDisplay} × ${result.actualHeightDisplay} ${unit}`,
      `Total resolution: ${result.totalPixelsW.toLocaleString()} × ${result.totalPixelsH.toLocaleString()} px`,
      `Screen area: ${result.sqFt.toFixed(1)} sq ft (${result.sqM.toFixed(2)} m²)`,
      `Panels: ${result.totalPanelsCeil} (${result.colsCeil} × ${result.rowsCeil})`,
    ].join('\n');
  }, [mode, calcTab, result, unit]);

  if (!fontsLoaded) {
    return null;
  }

  const headerSpace = HEADER_HEIGHT + insets.top;

  return (
    <View style={styles.pageWrapper}>
    <View style={styles.root} onLayout={onLayoutRootView}>
      <GlowBackground />
      <StatusBar style="light" />

      <View style={styles.body}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: headerSpace + space.md, paddingBottom: space.xl + insets.bottom + FLOATING_MENU_SPACE },
            ]}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
          >
            {mode === 'events' ? (
              <EventsRoot eventsTab={eventsTab} navTapCount={navTapCount} onGoToBookings={() => setEventsTab('bookings')} />
            ) : calcTab === 'stage' ? (
              <StageCalculatorScreen />
            ) : calcTab === 'settings' ? (
              <View style={styles.placeholder}>
                <Ionicons name="settings-outline" size={32} color={flat.textGhost} />
                <Text style={styles.placeholderText}>Settings coming soon</Text>
              </View>
            ) : (
              <>
            {/* Dimensions */}
            <View style={styles.section}>
              <View style={styles.unitToggle}>
                {(['m', 'ft'] as Unit[]).map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitButton, unit === u && styles.unitButtonActive]}
                    onPress={() => handleUnitChange(u)}
                  >
                    <Text style={[styles.unitButtonText, unit === u && styles.unitButtonTextActive]}>
                      {u === 'm' ? 'Meters' : 'Feet'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionTitle}>Screen Dimensions</Text>
              <QuickSizeChips items={QUICK_SIZES} onSelect={applyQuickSize} />

              <View style={styles.dimensionsRow}>
                <View style={styles.dimensionsCell}>
                  <DimensionInput
                    label={`Width (${unit})`}
                    value={widthInput}
                    onChangeText={handleWidthChange}
                    unit={unit}
                  />
                </View>
                <View style={styles.dimensionsCell}>
                  <DimensionInput
                    label={`Height (${unit})`}
                    value={heightInput}
                    onChangeText={handleHeightChange}
                    unit={unit}
                  />
                </View>
              </View>

              {isValid && result ? (
                <View style={styles.actualSizeRow}>
                  <Text style={styles.actualSizeLabel}>Actual screen size</Text>
                  <Text style={styles.actualSizeValue}>
                    {result.actualWidthDisplay} × {result.actualHeightDisplay} {unit}
                  </Text>
                </View>
              ) : null}
            </View>

            <Accordion
              title="Aspect Ratio"
              subtitle={lockedRatio ? `${lockedRatio.label} locked` : 'Free-form — no ratio locked'}
            >
              <AspectRatioSection
                lockedRatio={lockedRatio}
                onApplyPreset={applyPreset}
                customW={customW}
                customH={customH}
                onChangeCustomW={setCustomW}
                onChangeCustomH={setCustomH}
                onApplyCustom={applyCustomRatio}
                onUnlock={unlockRatio}
              />
            </Accordion>

            <Accordion title="Panel — P2.6 Standard" subtitle="500×500mm · 192×192px · 200W/panel">
              <PanelInfoSection />
            </Accordion>

            {/* Wall Preview */}
            <View style={[styles.section, { backgroundColor: flat.surfaceAlt, padding: 24 }]}>
              <View style={styles.previewHeaderRow}>
                <Text style={[styles.sectionTitle, styles.previewTitle]}>Wall Preview</Text>
                <View style={styles.previewBadges}>
                  {lockedRatio ? (
                    <View style={styles.ratioBadge}>
                      <Text style={styles.ratioBadgeText}>{lockedRatio.label}</Text>
                    </View>
                  ) : null}
                  {isValid && result ? (
                    <Text style={styles.panelsBadgeText}>
                      {result.colsCeil} × {result.rowsCeil} panels
                    </Text>
                  ) : null}
                </View>
              </View>
              <WallPreviewGrid
                cols={isValid && result ? result.colsCeil : 0}
                rows={isValid && result ? result.rowsCeil : 0}
                unit={unit}
              />
            </View>

            {isValid && result ? (
              <ResultCardGrid
                cards={[
                  {
                    label: 'Total Panels',
                    value: result.totalPanelsCeil.toString(),
                    sub: `${result.colsCeil} cols × ${result.rowsCeil} rows`,
                    color: neon.cyan,
                    icon: '▦',
                  },
                  {
                    label: 'Total Resolution',
                    value: `${result.totalPixelsW.toLocaleString()} × ${result.totalPixelsH.toLocaleString()}`,
                    sub: `${result.totalMegapixels.toFixed(2)} MP`,
                    color: neon.green,
                    icon: '⬛',
                  },
                  {
                    label: 'Aspect Ratio',
                    value: result.aspectRatioStr,
                    sub: `${result.colsCeil}:${result.rowsCeil} panels`,
                    color: neon.purple,
                    icon: '⬜',
                  },
                  {
                    label: 'Screen Area',
                    value: `${result.sqFt.toFixed(1)} sq ft`,
                    sub: `${result.sqM.toFixed(2)} m²`,
                    color: neon.mint,
                    icon: '📐',
                  },
                  {
                    label: 'Flight Boxes',
                    value: `${result.flightBoxes} boxes`,
                    sub: `8 panels/box · ${result.totalPanelsCeil} panels total`,
                    color: neon.orange,
                    icon: '📦',
                  },
                  {
                    label: 'Power & Circuits',
                    value: `${result.totalPowerKW.toFixed(1)} kW`,
                    sub: `${result.ampere16A}× 16A  or  ${result.ampere32A}× 32A @ 230V`,
                    color: neon.pink,
                    icon: '⚡',
                  },
                ]}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>▦</Text>
                <Text style={styles.emptyStateText}>
                  Enter width and height above to see your wall
                </Text>
                <Text style={styles.emptyStateSubtext}>Or tap a quick size above</Text>
              </View>
            )}

            {isValid && result ? (
              <Accordion
                title="Cables & Circuits"
                subtitle={`${result.powerMainCables} main power · ${result.dataMainCables} data cables`}
              >
                <CablesSection results={result} />
              </Accordion>
            ) : null}

            {isValid && result ? (
              <Accordion
                title="Pricing"
                subtitle={`$${calculateLedPrice(result.sqFt).toLocaleString('en-US', { maximumFractionDigits: 0 })} estimated total`}
                defaultOpen
              >
                <PricingSection results={result} />
              </Accordion>
            ) : null}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <Header
        title={
          mode === 'events'
            ? eventsTab === 'home'
              ? 'Home'
              : eventsTab === 'bookings'
                ? 'Bookings'
                : eventsTab === 'today'
                  ? 'Today'
                  : 'Settings'
            : calcTab === 'stage'
              ? 'Stage'
              : calcTab === 'settings'
                ? 'Settings'
                : 'Calculator'
        }
        getSummaryText={getSummaryText}
      />
      <AppNav
        mode={mode}
        activeTab={mode === 'calculator' ? calcTab : eventsTab}
        onSelectTab={(tab) => {
          setNavTapCount((n) => n + 1);
          if (mode === 'calculator') setCalcTab(tab as CalcTab);
          else setEventsTab(tab as EventsTab);
        }}
        onSwitchMode={() => setMode((m) => (m === 'calculator' ? 'events' : 'calculator'))}
      />
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // On a wide desktop browser the phone-shaped UI is centered in its own
  // column instead of stretching edge to edge; on an actual phone screen
  // (width already <= maxWidth) this has no visible effect.
  pageWrapper: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  root: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
  },
  scrollContent: {
    padding: space.lg,
  },
  section: {
    backgroundColor: flat.surface,
    borderWidth: 1,
    borderColor: flat.border,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.3,
    color: flat.textFaint,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  unitToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: flat.surfaceInput,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: flat.border,
    padding: 3,
    marginBottom: 16,
  },
  unitButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 4,
  },
  unitButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  unitButtonText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: flat.textFaint,
  },
  unitButtonTextActive: {
    color: flat.text,
  },
  actualSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: flat.surfaceAlt,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: flat.border,
  },
  actualSizeLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: flat.textFaint,
  },
  actualSizeValue: {
    fontFamily: fonts.regular,
    fontSize: 12,
    fontWeight: '500',
    color: neon.green,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  previewTitle: {
    marginBottom: 0,
  },
  dimensionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dimensionsCell: {
    flex: 1,
    minWidth: 0,
  },
  previewBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ratioBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.15)',
  },
  ratioBadgeText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(0, 212, 255, 0.7)',
  },
  panelsBadgeText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: neon.orange,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: flat.surfaceAlt,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: flat.border,
    borderRadius: 12,
    padding: 48,
    marginBottom: 16,
  },
  emptyStateIcon: {
    fontSize: 32,
    marginBottom: 12,
    opacity: 0.2,
    color: flat.text,
  },
  emptyStateText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: flat.textGhost,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.15)',
    marginTop: 8,
    textAlign: 'center',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
    gap: 12,
  },
  placeholderText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: flat.textGhost,
  },
});
