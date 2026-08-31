import React from 'react';
import Svg, { Circle, Line, Path, G } from 'react-native-svg';
import { color } from '@/theme/tokens';

const SIZE = 200;
const C = SIZE / 2;

/** Concentric fit-ring echo, with sensor dots around the rim — mirrors the
 * FitRing component so this reads as the same product from screen one. */
export function FitIllustration() {
  const dots = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = 74;
    return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r, hot: i === 2 || i === 3 };
  });
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Circle cx={C} cy={C} r={58} stroke={color.line} strokeWidth={10} fill="none" />
      <Circle
        cx={C}
        cy={C}
        r={58}
        stroke={color.cyan}
        strokeWidth={10}
        fill="none"
        strokeDasharray={`${2 * Math.PI * 58 * 0.72} ${2 * Math.PI * 58}`}
        strokeLinecap="round"
        rotation={-90}
        origin={`${C},${C}`}
      />
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={5} fill={d.hot ? color.amber : color.cyan} opacity={d.hot ? 1 : 0.55} />
      ))}
      <Circle cx={C} cy={C} r={30} fill={color.panel} stroke={color.stroke} strokeWidth={1} />
    </Svg>
  );
}

/** A simple trend line rising through a soft grid — echoes the Trends tab's
 * bar/line charts. */
export function TrendsIllustration() {
  const points = [180, 150, 160, 110, 120, 70, 90, 40];
  const step = (SIZE - 40) / (points.length - 1);
  const path = points
    .map((y, i) => `${i === 0 ? 'M' : 'L'} ${20 + i * step} ${y}`)
    .join(' ');
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      {[60, 100, 140, 180].map((y) => (
        <Line key={y} x1={20} y1={y} x2={SIZE - 20} y2={y} stroke={color.line} strokeWidth={1} />
      ))}
      <Path d={path} stroke={color.cyan} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((y, i) => (
        <Circle key={i} cx={20 + i * step} cy={y} r={i === points.length - 1 ? 6 : 3.5} fill={i === points.length - 1 ? color.cyan : color.panel} stroke={color.cyan} strokeWidth={2} />
      ))}
    </Svg>
  );
}

/** Two connected nodes — device <-> app <-> care team — for the "stay
 * connected" page. */
export function ConnectIllustration() {
  const left = { x: 46, y: C };
  const mid = { x: C, y: C };
  const right = { x: SIZE - 46, y: C };
  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Line x1={left.x} y1={left.y} x2={mid.x} y2={mid.y} stroke={color.cyan} strokeWidth={2} strokeDasharray="6 6" opacity={0.6} />
      <Line x1={mid.x} y1={mid.y} x2={right.x} y2={right.y} stroke={color.cyan} strokeWidth={2} strokeDasharray="6 6" opacity={0.6} />
      <G>
        <Circle cx={left.x} cy={left.y} r={28} fill={color.panel} stroke={color.line} strokeWidth={1} />
        <Circle cx={left.x} cy={left.y} r={8} fill={color.cyan} opacity={0.85} />
      </G>
      <G>
        <Circle cx={mid.x} cy={mid.y} r={38} fill={color.panelGradTop} stroke={color.cyan} strokeWidth={2} />
        <Path
          d={`M ${mid.x - 12} ${mid.y} l 7 -10 l 6 16 l 6 -12 l 5 6 l 10 0`}
          stroke={color.cyan}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      <G>
        <Circle cx={right.x} cy={right.y} r={28} fill={color.panel} stroke={color.line} strokeWidth={1} />
        <Path d={`M ${right.x} ${right.y - 8} c -6 -8 -18 -2 -12 8 c 4 6 12 10 12 12 c 0 -2 8 -6 12 -12 c 6 -10 -6 -16 -12 -8 z`} fill={color.green} opacity={0.85} />
      </G>
    </Svg>
  );
}
