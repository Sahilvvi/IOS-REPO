import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';
import { color } from '@/theme/tokens';

/**
 * Vector settings gear for header buttons — replaces the "⚙" emoji glyph
 * used across every screen's top-right settings link, which rendered as a
 * dull system-font character rather than a real icon and read inconsistently
 * across devices. Shares the tab bar's gear construction (see TabIcons.tsx's
 * 'settings' case) so both settings entry points read as the same icon.
 */
export function GearIcon({ size = 18, tint = color.cyan }: { size?: number; tint?: string }) {
  const props = { stroke: tint, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const teeth = [0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
    const rad = (deg * Math.PI) / 180;
    const x1 = 12 + Math.cos(rad) * 7.6;
    const y1 = 12 + Math.sin(rad) * 7.6;
    const x2 = 12 + Math.cos(rad) * 9.6;
    const y2 = 12 + Math.sin(rad) * 9.6;
    return <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} {...props} strokeWidth={3} strokeLinecap="butt" />;
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {teeth}
      <Circle cx={12} cy={12} r={5.5} {...props} strokeWidth={2} />
      <Circle cx={12} cy={12} r={1.4} fill={tint} stroke="none" />
    </Svg>
  );
}
