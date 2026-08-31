import React from 'react';
import Svg, { Circle, Line, Path, G } from 'react-native-svg';
import { color } from '@/theme/tokens';

const SIZE = 240;
const C = SIZE / 2;

/** Faint dashed orbit ring drawn behind every illustration — a shared bit of
 * visual rhythm across the three onboarding pages so they read as one set,
 * not three unrelated icons. */
function Orbit() {
  return <Circle cx={C} cy={C} r={C - 6} stroke={color.line} strokeWidth={1} strokeDasharray="2 8" fill="none" opacity={0.6} />;
}

/** Concentric fit-ring echo, with sensor dots around the rim — mirrors the
 * FitRing component so this reads as the same product from screen one. */
export function FitIllustration() {
  const dots = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = 84;
    return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r, hot: i === 2 || i === 3 };
  });
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Orbit />
      <Circle cx={C} cy={C} r={64} stroke={color.line} strokeWidth={11} fill="none" />
      <Circle
        cx={C}
        cy={C}
        r={64}
        stroke={color.cyan}
        strokeWidth={11}
        fill="none"
        strokeDasharray={`${2 * Math.PI * 64 * 0.72} ${2 * Math.PI * 64}`}
        strokeLinecap="round"
        rotation={-90}
        origin={`${C},${C}`}
      />
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={5.5} fill={d.hot ? color.amber : color.cyan} opacity={d.hot ? 1 : 0.55} />
      ))}
      <Circle cx={C} cy={C} r={34} fill={color.panel} stroke={color.stroke} strokeWidth={1} />
      <Circle cx={C} cy={C} r={5} fill={color.cyan} />
    </Svg>
  );
}

/** A simple trend line rising through a soft grid — echoes the Trends tab's
 * bar/line charts. */
export function TrendsIllustration() {
  const points = [200, 165, 178, 122, 134, 76, 100, 42];
  const pad = 44;
  const step = (SIZE - pad * 2) / (points.length - 1);
  const path = points
    .map((y, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * step} ${y}`)
    .join(' ');
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Orbit />
      {[70, 120, 170, 210].map((y) => (
        <Line key={y} x1={pad} y1={y} x2={SIZE - pad} y2={y} stroke={color.line} strokeWidth={1} />
      ))}
      <Path d={path} stroke={color.cyan} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((y, i) => (
        <Circle key={i} cx={pad + i * step} cy={y} r={i === points.length - 1 ? 7 : 4} fill={i === points.length - 1 ? color.cyan : color.panel} stroke={color.cyan} strokeWidth={2} />
      ))}
    </Svg>
  );
}

/** Two connected nodes — device <-> app <-> care team — for the "stay
 * connected" page. */
export function ConnectIllustration() {
  const left = { x: 54, y: C };
  const mid = { x: C, y: C };
  const right = { x: SIZE - 54, y: C };
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Orbit />
      <Line x1={left.x} y1={left.y} x2={mid.x} y2={mid.y} stroke={color.cyan} strokeWidth={2} strokeDasharray="6 6" opacity={0.6} />
      <Line x1={mid.x} y1={mid.y} x2={right.x} y2={right.y} stroke={color.cyan} strokeWidth={2} strokeDasharray="6 6" opacity={0.6} />
      <G>
        <Circle cx={left.x} cy={left.y} r={32} fill={color.panel} stroke={color.line} strokeWidth={1} />
        <Circle cx={left.x} cy={left.y} r={9} fill={color.cyan} opacity={0.85} />
      </G>
      <G>
        <Circle cx={mid.x} cy={mid.y} r={44} fill={color.panelGradTop} stroke={color.cyan} strokeWidth={2} />
        <Path
          d={`M ${mid.x - 14} ${mid.y} l 8 -12 l 7 19 l 7 -14 l 6 7 l 12 0`}
          stroke={color.cyan}
          strokeWidth={2.75}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      <G>
        <Circle cx={right.x} cy={right.y} r={32} fill={color.panel} stroke={color.line} strokeWidth={1} />
        <Path d={`M ${right.x} ${right.y - 9} c -7 -9 -20 -2 -13 9 c 4 6 13 11 13 13 c 0 -2 9 -7 13 -13 c 7 -11 -6 -18 -13 -9 z`} fill={color.green} opacity={0.9} />
      </G>
    </Svg>
  );
}
