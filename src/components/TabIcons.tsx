import React from 'react';
import Svg, { Circle, Path, Line, Rect } from 'react-native-svg';
import { color } from '@/theme/tokens';

export type TabIconName = 'today' | 'fit' | 'trends' | 'care' | 'sessions' | 'settings';

/** Thin-stroke geometric icon set replacing the generic Ionicons tab bar —
 * drawn in the same instrument-HUD idiom as FitRing/InstrumentBackdrop
 * (circles, arcs, minimal glyphs) instead of filled default icons. */
export function TabIcon({ name, focused, size = 22 }: { name: TabIconName; focused: boolean; size?: number }) {
  const c = focused ? color.cyan : color.textFaint;
  const w = focused ? 1.8 : 1.5;
  const props = { stroke: c, strokeWidth: w, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (name) {
    case 'today':
      // A partial instrument ring — echoes FitRing's own arc-of-progress motif.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={8} {...props} strokeOpacity={0.35} />
          <Path d="M12 4 A8 8 0 0 1 19.3 15.5" {...props} />
          <Circle cx={12} cy={12} r={2.4} fill={c} stroke="none" />
        </Svg>
      );
    case 'fit':
      // A socket cross-section — a cup shape with a sensor point on the wall.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M6 5 L5 15 Q5 19 12 19 Q19 19 19 15 L18 5" {...props} />
          <Circle cx={18} cy={11} r={1.6} fill={c} stroke="none" />
        </Svg>
      );
    case 'trends':
      // A sparkline with a lit endpoint.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4 16 L9 10 L13 13 L20 5" {...props} />
          <Circle cx={20} cy={5} r={1.8} fill={c} stroke="none" />
        </Svg>
      );
    case 'care':
      // A pulse/ECG line.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M3 12 H8 L10.5 6 L14 18 L16 12 H21" {...props} />
        </Svg>
      );
    case 'sessions':
      // Stacked log bars, uneven lengths like a real recording list.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Line x1={4} y1={6} x2={20} y2={6} {...props} />
          <Line x1={4} y1={12} x2={16} y2={12} {...props} />
          <Line x1={4} y1={18} x2={13} y2={18} {...props} />
        </Svg>
      );
    case 'settings':
      // A gear-ring — a ring with tick marks, matching the "instrument"
      // vocabulary rather than a literal filled gear glyph.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={5.5} {...props} />
          {[0, 60, 120, 180, 240, 300].map(deg => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 12 + Math.cos(rad) * 8.4;
            const y1 = 12 + Math.sin(rad) * 8.4;
            const x2 = 12 + Math.cos(rad) * 10.4;
            const y2 = 12 + Math.sin(rad) * 10.4;
            return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} {...props} />;
          })}
        </Svg>
      );
    default:
      return <Rect width={size} height={size} fill="none" />;
  }
}
