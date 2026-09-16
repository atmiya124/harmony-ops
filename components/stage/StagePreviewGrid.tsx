import { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Orientation, Unit, ftToUnit } from '../../utils/stageCalculator';
import { fonts } from '../../theme/theme';
import { flat } from '../../theme/ledTheme';

interface StagePreviewGridProps {
  panelsAlongLength: number;
  panelsAlongWidth: number;
  totalLengthFt: number;
  totalWidthFt: number;
  orientation: Orientation;
  unit: Unit;
}

const MAX_DISPLAY = 24; // cap total displayed cells so huge grids stay readable
const MAX_PREVIEW_HEIGHT = 260;
const GAP = 4;
const CELL_BORDER = '#5b9bf5';
const CELL_FILL = 'rgba(91, 155, 245, 0.08)';

export default function StagePreviewGrid({
  panelsAlongLength,
  panelsAlongWidth,
  totalLengthFt,
  totalWidthFt,
  orientation,
  unit,
}: StagePreviewGridProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  const isEmpty = panelsAlongLength === 0 || panelsAlongWidth === 0;
  const truncated = panelsAlongLength * panelsAlongWidth > MAX_DISPLAY;

  // When truncated, shrink both axes proportionally rather than just
  // chopping columns, so the preview still reads as the right shape.
  const scaleDown = truncated ? Math.sqrt(MAX_DISPLAY / (panelsAlongLength * panelsAlongWidth)) : 1;
  const displayCols = Math.max(1, Math.min(panelsAlongLength, Math.round(panelsAlongLength * scaleDown)));
  const displayRows = Math.max(1, Math.min(panelsAlongWidth, Math.round(panelsAlongWidth * scaleDown)));

  const unitLabel = unit === 'm' ? 'm' : 'ft';
  const lengthDisplay = ftToUnit(totalLengthFt, unit).toFixed(unit === 'm' ? 2 : 1);
  const widthDisplay = ftToUnit(totalWidthFt, unit).toFixed(unit === 'm' ? 2 : 1);

  // A single panel is 8ft x 4ft. Orientation decides which edge is
  // horizontal, which sets the cell's width:height ratio.
  const cellAspect = orientation === 'horizontal' ? 2 : 0.5; // width / height

  function onLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  if (isEmpty) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>Enter dimensions to preview</Text>
      </View>
    );
  }

  let cellWidth = 40;
  let cellHeight = cellWidth / cellAspect;
  if (containerWidth > 0) {
    cellWidth = (containerWidth - (displayCols - 1) * GAP) / displayCols;
    cellHeight = cellWidth / cellAspect;
    const totalHeight = displayRows * cellHeight + (displayRows - 1) * GAP;
    if (totalHeight > MAX_PREVIEW_HEIGHT) {
      const scale = MAX_PREVIEW_HEIGHT / totalHeight;
      cellWidth *= scale;
      cellHeight *= scale;
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.dimensionLineRow}>
        <View style={styles.dimensionLineFull} />
        <View style={styles.dimensionPill}>
          <Text style={styles.dimensionPillText}>
            {lengthDisplay} {unitLabel}
          </Text>
        </View>
      </View>

      <View style={styles.bodyRow}>
        <View style={styles.dimensionColumn}>
          <View style={styles.dimensionLineVerticalFull} />
          <View style={[styles.dimensionPill, styles.dimensionPillVertical]}>
            <Text style={styles.dimensionPillText}>
              {widthDisplay} {unitLabel}
            </Text>
          </View>
        </View>

        <View style={styles.gridContainer} onLayout={onLayout}>
          <View style={styles.grid}>
            {Array.from({ length: displayRows }).map((_, row) => (
              <View key={row} style={styles.gridRow}>
                {Array.from({ length: displayCols }).map((__, col) => (
                  <View key={col} style={[styles.cell, { width: cellWidth, height: cellHeight }]} />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>

      {truncated ? (
        <Text style={styles.truncationNote}>
          Preview simplified — {panelsAlongLength}×{panelsAlongWidth} panels total
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBox: {
    minHeight: 120,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: flat.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: flat.textGhost,
  },
  wrapper: {
    backgroundColor: '#0a0a0f',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  dimensionLineRow: {
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginLeft: 36,
  },
  dimensionLineFull: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dimensionPill: {
    flexShrink: 0,
    alignSelf: 'center',
    backgroundColor: '#000000',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginHorizontal: 8,
  },
  dimensionPillVertical: {
    // Rotate the whole pill (not just the text) so its size is computed
    // from its own natural content width before rotation is applied —
    // rotating text alone inside a narrow parent forces it to wrap.
    transform: [{ rotate: '-90deg' }],
  },
  dimensionPillText: {
    // Explicit width guarantees a single line regardless of how narrow the
    // surrounding column is — matches the fix used for WallPreviewGrid's
    // rotated label, where relying on the parent's available width alone
    // still let the text wrap before the rotation transform was applied.
    width: 60,
    flexShrink: 0,
    fontFamily: fonts.regular,
    fontSize: 10,
    fontWeight: '400',
    color: flat.textDim,
    textAlign: 'center',
  },
  bodyRow: {
    flexDirection: 'row',
  },
  dimensionColumn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  dimensionLineVerticalFull: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    marginLeft: -0.5,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  gridContainer: {
    flex: 1,
  },
  grid: {
    gap: GAP,
    alignSelf: 'flex-start',
  },
  gridRow: {
    flexDirection: 'row',
    gap: GAP,
  },
  cell: {
    borderWidth: 1.5,
    borderColor: CELL_BORDER,
    backgroundColor: CELL_FILL,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  truncationNote: {
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: 'rgba(255, 170, 0, 0.6)',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
