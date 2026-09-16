import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import QuickSizeChips from '../shared/QuickSizeChips';
import DimensionInput from '../led/DimensionInput';
import Accordion from '../led/Accordion';
import ResultCardGrid from '../shared/ResultCardGrid';
import StagePreviewGrid from './StagePreviewGrid';
import StagePanelInfoSection from './StagePanelInfoSection';
import StagePricingSection from './StagePricingSection';
import LegIcon from '../icons/LegIcon';
import SupportIcon from '../icons/SupportIcon';
import Support8Icon from '../icons/Support8Icon';
import PanelIcon from '../icons/PanelIcon';
import {
  calculateStage,
  calculateStagePrice,
  ftToUnit,
  unitToFt,
  fmt,
  STAGE_QUICK_SIZES,
  Orientation,
  Unit,
} from '../../utils/stageCalculator';
import { fonts } from '../../theme/theme';
import { flat, neon } from '../../theme/ledTheme';

export default function StageCalculatorScreen() {
  const [unit, setUnit] = useState<Unit>('ft');
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [lengthInput, setLengthInput] = useState('8');
  const [widthInput, setWidthInput] = useState('4');

  const lengthVal = parseFloat(lengthInput) || 0;
  const widthVal = parseFloat(widthInput) || 0;
  const isValid = lengthVal > 0 && widthVal > 0;

  const result = useMemo(
    () => calculateStage(lengthVal, widthVal, unit, orientation),
    [lengthVal, widthVal, unit, orientation]
  );

  const applyQuickSize = useCallback((q: (typeof STAGE_QUICK_SIZES)[number]) => {
    setUnit(q.u);
    setLengthInput(String(q.length));
    setWidthInput(String(q.width));
  }, []);

  const handleUnitChange = useCallback(
    (newUnit: Unit) => {
      const lengthFt = unitToFt(parseFloat(lengthInput) || 0, unit);
      const widthFt = unitToFt(parseFloat(widthInput) || 0, unit);
      setLengthInput(fmt(ftToUnit(lengthFt, newUnit)));
      setWidthInput(fmt(ftToUnit(widthFt, newUnit)));
      setUnit(newUnit);
    },
    [unit, lengthInput, widthInput]
  );

  return (
    <>
      {/* Dimensions */}
      <View style={styles.section}>
        <View style={styles.unitToggle}>
          {(['ft', 'm'] as Unit[]).map((u) => (
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

        <View style={styles.orientationToggle}>
          {(['horizontal', 'vertical'] as Orientation[]).map((o) => (
            <TouchableOpacity
              key={o}
              style={[styles.orientationButton, orientation === o && styles.orientationButtonActive]}
              onPress={() => setOrientation(o)}
            >
              <Text
                style={[
                  styles.orientationButtonText,
                  orientation === o && styles.orientationButtonTextActive,
                ]}
              >
                {o === 'horizontal' ? '↔ Horizontal' : '↕ Vertical'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Stage Dimensions</Text>
        <QuickSizeChips items={STAGE_QUICK_SIZES} onSelect={applyQuickSize} />

        <View style={styles.dimensionsRow}>
          <View style={styles.dimensionsCell}>
            <DimensionInput
              label={`Length (${unit})`}
              value={lengthInput}
              onChangeText={setLengthInput}
              unit={unit}
            />
          </View>
          <View style={styles.dimensionsCell}>
            <DimensionInput
              label={`Width (${unit})`}
              value={widthInput}
              onChangeText={setWidthInput}
              unit={unit}
            />
          </View>
        </View>

        {isValid && result ? (
          <View style={styles.actualSizeRow}>
            <Text style={styles.actualSizeLabel}>Actual stage size</Text>
            <Text style={styles.actualSizeValue}>
              {fmt(ftToUnit(result.totalLengthFt, unit))} × {fmt(ftToUnit(result.totalWidthFt, unit))} {unit}
            </Text>
          </View>
        ) : null}
      </View>

      <Accordion title="Platform — 4×8 Standard" subtitle="4 legs · 2×8' + 2×4' support per panel">
        <StagePanelInfoSection />
      </Accordion>

      {/* Stage Preview */}
      <View style={[styles.section, { backgroundColor: flat.surfaceAlt, padding: 24 }]}>
        <View style={styles.previewHeaderRow}>
          <Text style={[styles.sectionTitle, styles.previewTitle]}>Stage Preview</Text>
          {isValid && result ? (
            <Text style={styles.panelsBadgeText}>
              {result.panelsAlongLength} × {result.panelsAlongWidth} panels
            </Text>
          ) : null}
        </View>
        <StagePreviewGrid
          panelsAlongLength={isValid && result ? result.panelsAlongLength : 0}
          panelsAlongWidth={isValid && result ? result.panelsAlongWidth : 0}
          totalLengthFt={result?.totalLengthFt ?? 0}
          totalWidthFt={result?.totalWidthFt ?? 0}
          orientation={orientation}
          unit={unit}
        />
      </View>

      {isValid && result ? (
        <ResultCardGrid
          cards={[
            {
              label: 'Total Panels',
              value: result.totalPanels.toString(),
              color: neon.cyan,
              icon: <PanelIcon size={44} color={neon.cyan} />,
              large: true,
            },
            {
              label: 'Legs',
              value: result.legs.toString(),
              color: neon.green,
              icon: <LegIcon size={56} color={neon.green} />,
              large: true,
            },
            {
              label: "8' Support",
              value: result.support8ft.toString(),
              color: neon.purple,
              icon: <Support8Icon size={56} color={neon.purple} />,
              large: true,
            },
            {
              label: "4' Support",
              value: result.support4ft.toString(),
              color: neon.mint,
              icon: <SupportIcon size={44} color={neon.mint} />,
              large: true,
            },
            {
              label: 'Stage Area',
              value: `${result.areaSqFt.toFixed(0)} sq ft`,
              color: neon.orange,
              icon: '📐',
              large: true,
            },
          ]}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>▦</Text>
          <Text style={styles.emptyStateText}>Enter length and width above to see your stage</Text>
          <Text style={styles.emptyStateSubtext}>Or tap a quick size above</Text>
        </View>
      )}

      {isValid && result ? (
        <Accordion
          title="Pricing"
          subtitle={`$${calculateStagePrice(result.totalPanels).toLocaleString('en-US', { maximumFractionDigits: 0 })} estimated total`}
          defaultOpen
        >
          <StagePricingSection results={result} />
        </Accordion>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
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
  previewTitle: {
    marginBottom: 0,
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
  orientationToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  orientationButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: flat.surfaceInput,
    borderWidth: 1,
    borderColor: flat.border,
  },
  orientationButtonActive: {
    backgroundColor: 'rgba(91, 155, 245, 0.15)',
    borderColor: 'rgba(91, 155, 245, 0.4)',
  },
  orientationButtonText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    fontWeight: '500',
    color: flat.textFaint,
  },
  orientationButtonTextActive: {
    color: '#5b9bf5',
  },
  dimensionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dimensionsCell: {
    flex: 1,
    minWidth: 0,
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
});
