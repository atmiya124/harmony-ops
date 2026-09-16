import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PANEL, Unit, mmToUnit } from '../../utils/ledCalculator';
import { flat, neon } from '../../theme/ledTheme';
import { fonts } from '../../theme/theme';

interface WallPreviewGridProps {
  cols: number;
  rows: number;
  unit: Unit;
}

const MAX_DISPLAY_COLS = 40;
const MAX_DISPLAY_ROWS = 20;
const MAX_PREVIEW_HEIGHT = 220;
const MIN_CELL = 4;
const MAX_CELL = 24;
const SEAM = 1;

export default function WallPreviewGrid({ cols, rows, unit }: WallPreviewGridProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [selected, setSelected] = useState<{ col: number; row: number } | null>(null);

  const isEmpty = cols === 0 || rows === 0;
  const displayCols = Math.min(cols, MAX_DISPLAY_COLS);
  const displayRows = Math.min(rows, MAX_DISPLAY_ROWS);
  const truncated = cols > MAX_DISPLAY_COLS || rows > MAX_DISPLAY_ROWS;

  const unitLabel = unit === 'm' ? 'm' : 'ft';
  const panelW = mmToUnit(PANEL.widthMm, unit).toFixed(2);
  const panelH = mmToUnit(PANEL.heightMm, unit).toFixed(2);

  function onLayout(e: LayoutChangeEvent) {
    setContainerWidth(e.nativeEvent.layout.width);
  }

  // Integer cell sizes + a fixed `gap` (rather than per-cell margins) keep
  // every seam the same width — fractional pixel sizes round inconsistently
  // across cells and make the gaps look uneven.
  let cellSize = MIN_CELL;
  if (containerWidth > 0 && displayCols > 0 && displayRows > 0) {
    const widthBudget = containerWidth - (displayCols - 1) * SEAM;
    cellSize = Math.min(MAX_CELL, Math.floor(widthBudget / displayCols));
    const heightBudget = MAX_PREVIEW_HEIGHT - (displayRows - 1) * SEAM;
    if (cellSize * displayRows + (displayRows - 1) * SEAM > MAX_PREVIEW_HEIGHT) {
      cellSize = Math.floor(heightBudget / displayRows);
    }
    cellSize = Math.max(MIN_CELL, cellSize);
  }

  if (isEmpty) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>Enter dimensions to preview</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.widthLabel}>
        ↔ {mmToUnit(PANEL.widthMm * cols, unit).toFixed(2)} {unitLabel}
      </Text>

      <View style={styles.gridRow}>
        <View style={styles.heightLabelBox}>
          <Text style={styles.heightLabel}>
            ↔ {mmToUnit(PANEL.heightMm * rows, unit).toFixed(2)} {unitLabel}
          </Text>
        </View>

        <View style={styles.gridContainer} onLayout={onLayout}>
          <View style={styles.bezel}>
            <View style={styles.grid}>
              {Array.from({ length: displayRows }).map((_, row) => (
                <View key={row} style={styles.gridRowLine}>
                  {Array.from({ length: displayCols }).map((__, col) => {
                    const isSelected = selected?.col === col && selected?.row === row;
                    return (
                      <TouchableOpacity
                        key={col}
                        activeOpacity={0.7}
                        style={[
                          styles.cell,
                          { width: cellSize, height: cellSize },
                          isSelected && styles.cellSelected,
                        ]}
                        onPress={() => setSelected(isSelected ? null : { col, row })}
                      />
                    );
                  })}
                </View>
              ))}
              <LinearGradient
                pointerEvents="none"
                colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.05)']}
                locations={[0, 0.55, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            </View>
          </View>
        </View>
      </View>

      {truncated ? (
        <Text style={styles.truncationNote}>
          Preview shows {displayCols}×{displayRows} of {cols}×{rows} panels
        </Text>
      ) : null}

      {selected ? (
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>
            Panel [{selected.col + 1}, {selected.row + 1}] — {panelW} × {panelH} {unitLabel} —{' '}
            {PANEL.pixelsW}×{PANEL.pixelsH}px
          </Text>
        </View>
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
    alignItems: 'center',
  },
  widthLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    fontWeight: '500',
    color: flat.textDim,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  heightLabelBox: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heightLabel: {
    width: 90,
    fontFamily: fonts.regular,
    fontSize: 11,
    fontWeight: '500',
    color: flat.textDim,
    transform: [{ rotate: '-90deg' }],
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  gridContainer: {
    flex: 1,
  },
  bezel: {
    alignSelf: 'center',
    backgroundColor: '#050708',
    padding: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.4)',
    elevation: 8,
  },
  grid: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 1,
    borderRadius: 4,
    overflow: 'hidden',
    gap: SEAM,
  },
  gridRowLine: {
    flexDirection: 'row',
    gap: SEAM,
  },
  cell: {
    backgroundColor: 'rgba(0, 212, 255, 0.3)',
    borderRadius: 1,
  },
  cellSelected: {
    backgroundColor: neon.cyan,
    boxShadow: '0px 0px 4px rgba(0, 212, 255, 0.9)',
  },
  truncationNote: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: 'rgba(255, 170, 0, 0.6)',
    letterSpacing: 0.5,
  },
  tooltip: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    borderRadius: 6,
  },
  tooltipText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: 'rgba(0, 212, 255, 0.8)',
    letterSpacing: 0.3,
  },
});
