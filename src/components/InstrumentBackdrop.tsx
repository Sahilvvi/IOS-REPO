import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, {
  Defs,
  Pattern,
  Line,
  Rect,
  Mask,
  LinearGradient,
  RadialGradient,
  Stop,
  Circle,
} from 'react-native-svg';
import { color } from '@/theme/tokens';

/** A literal 44px sensor-grid texture (echoes the app's real 3x6 pressure
 * grid) instead of generic decorative glow blobs — the backdrop for every
 * "first thing you see" screen (splash, onboarding, login). `fade` picks
 * how it's masked out so it never reads as a flat repeating pattern. */
export function SensorGridTexture({
  width,
  height,
  fade = 'top',
}: {
  width: number;
  height: number;
  fade?: 'top' | 'radial' | 'none';
}) {
  const maskId = `grid-mask-${fade}`;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id="sensorGrid" width={44} height={44} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={44} y2={0} stroke={color.text} strokeWidth={1} strokeOpacity={0.05} />
          <Line x1={0} y1={0} x2={0} y2={44} stroke={color.text} strokeWidth={1} strokeOpacity={0.05} />
        </Pattern>
        {fade === 'top' && (
          <LinearGradient id={maskId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#fff" stopOpacity={1} />
            <Stop offset="0.4" stopColor="#fff" stopOpacity={1} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </LinearGradient>
        )}
        {fade === 'radial' && (
          <RadialGradient id={maskId} cx="72%" cy="26%" r="60%">
            <Stop offset="0" stopColor="#fff" stopOpacity={1} />
            <Stop offset="1" stopColor="#fff" stopOpacity={0} />
          </RadialGradient>
        )}
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={color.bg} />
      {fade === 'none' ? (
        <Rect x={0} y={0} width={width} height={height} fill="url(#sensorGrid)" />
      ) : (
        <>
          <Mask id="gridFadeMask">
            <Rect x={0} y={0} width={width} height={height} fill={`url(#${maskId})`} />
          </Mask>
          <Rect x={0} y={0} width={width} height={height} fill="url(#sensorGrid)" mask="url(#gridFadeMask)" />
        </>
      )}
    </Svg>
  );
}

/** The decorative partial instrument-ring accent bleeding off a corner —
 * the same visual grammar as the app's real FitRing, used as texture here
 * rather than data. `progress` (0-1) sets how much of the outer arc is lit. */
export function CornerRing({ size = 260, progress = 0.22 }: { size?: number; progress?: number }) {
  const c = size / 2;
  const rOuter = size * 0.415;
  const rInner = size * 0.33;
  const circOuter = 2 * Math.PI * rOuter;
  const circInner = 2 * Math.PI * rInner;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: -size * 0.37, right: -size * 0.37 }}>
      <Circle cx={c} cy={c} r={rOuter} stroke={color.line} strokeWidth={1.5} fill="none" />
      <Circle
        cx={c} cy={c} r={rOuter}
        stroke={color.cyan} strokeWidth={1.5} fill="none"
        strokeDasharray={`${circOuter * progress} ${circOuter}`}
        strokeLinecap="round"
        rotation={-90}
        origin={`${c},${c}`}
      />
      <Circle cx={c} cy={c} r={rInner} stroke={color.line} strokeWidth={1} fill="none" />
      <Circle
        cx={c} cy={c} r={rInner}
        stroke={color.green} strokeWidth={1} fill="none" opacity={0.7}
        strokeDasharray={`${circInner * 0.16} ${circInner}`}
        strokeLinecap="round"
        rotation={140}
        origin={`${c},${c}`}
      />
    </Svg>
  );
}
