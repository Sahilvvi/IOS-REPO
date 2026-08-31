import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { color, radius } from '@/theme/tokens';

// A believable-looking still frame of the real 18-cell grid: mostly cool
// (idle) cells with a couple of warm ones lit, so it reads as live data
// rather than a decorative pattern. Matches the app's actual sensor count.
const CELLS = [
  0, 1, 0, 2, 3, 0,
  0, 1, 0, 0, 4, 0,
  0, 0, 1, 0, 0, 0,
];
const TONES = [
  'transparent',
  color.cyan + '30',
  color.cyan + '80',
  color.amber,
  color.green + '80',
];

export function MiniSensorGrid({ cell = 14, gap = 5, cols = 3 }: { cell?: number; gap?: number; cols?: number }) {
  return (
    <View style={[styles.grid, { width: cols * cell + (cols - 1) * gap }]}>
      {CELLS.map((v, i) => (
        <Animated.View
          key={i}
          entering={FadeIn.delay(500 + i * 28).duration(260)}
          style={[
            styles.cell,
            {
              width: cell,
              height: cell,
              marginRight: gap,
              marginBottom: gap,
              backgroundColor: v === 0 ? color.cellBg : TONES[v],
              borderColor: v === 0 ? color.cellLine : 'transparent',
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { borderRadius: radius.sm - 7, borderWidth: 1 },
});
