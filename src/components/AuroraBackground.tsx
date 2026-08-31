import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle } from 'react-native-svg';
import { color } from '@/theme/tokens';

/** Shared decorative backdrop for the splash/onboarding + login screens —
 * soft glow blobs and a faint dot grid instead of a flat black wash, so the
 * "first thing you see" screens feel designed rather than a bare template. */
export function AuroraBackground({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id="glowA" cx="50%" cy="0%" r="75%">
          <Stop offset="0" stopColor={color.cyan} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color.cyan} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glowB" cx="90%" cy="85%" r="60%">
          <Stop offset="0" stopColor="#2E5EE8" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#2E5EE8" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glowC" cx="8%" cy="70%" r="45%">
          <Stop offset="0" stopColor={color.green} stopOpacity={0.08} />
          <Stop offset="1" stopColor={color.green} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={color.bg} />
      <Rect x={0} y={0} width={width} height={height} fill="url(#glowA)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#glowB)" />
      <Rect x={0} y={0} width={width} height={height} fill="url(#glowC)" />
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 6 }, (_, col) => (
          <Circle
            key={`${row}-${col}`}
            cx={(width / 6) * col + width / 12}
            cy={(height / 8) * row + height / 16}
            r={1}
            fill={color.textFaint}
            opacity={0.35}
          />
        ))
      )}
    </Svg>
  );
}
