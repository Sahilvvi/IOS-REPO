import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { color } from '@/theme/tokens';

/** Device <-> app <-> care-team nodes, each appearing in sequence rather
 * than all at once — reads as a connection being established, not a static
 * diagram. */
export function HeroConnectDiagram({ width = 300, height = 220 }: { width?: number; height?: number }) {
  const cy = height / 2;
  const left = { x: width * 0.16, y: cy };
  const mid = { x: width / 2, y: cy };
  const right = { x: width * 0.84, y: cy };

  return (
    <View style={{ width, height }}>
      <Animated.View entering={FadeIn.delay(150).duration(500)} style={{ position: 'absolute', width, height }}>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Line x1={left.x} y1={left.y} x2={mid.x} y2={mid.y} stroke={color.cyan} strokeWidth={2} strokeDasharray="6 7" opacity={0.55} />
          <Line x1={mid.x} y1={mid.y} x2={right.x} y2={right.y} stroke={color.cyan} strokeWidth={2} strokeDasharray="6 7" opacity={0.55} />
        </Svg>
      </Animated.View>

      <Animated.View entering={ZoomIn.delay(250).springify().damping(11)} style={{ position: 'absolute', left: left.x - 30, top: left.y - 30 }}>
        <Svg width={60} height={60} viewBox="0 0 60 60">
          <Circle cx={30} cy={30} r={28} fill={color.panel} stroke={color.line} strokeWidth={1} />
          <Circle cx={30} cy={30} r={8} fill={color.cyan} opacity={0.9} />
        </Svg>
      </Animated.View>

      <Animated.View entering={ZoomIn.delay(500).springify().damping(10)} style={{ position: 'absolute', left: mid.x - 42, top: mid.y - 42 }}>
        <Svg width={84} height={84} viewBox="0 0 84 84">
          <Circle cx={42} cy={42} r={40} fill={color.panelGradTop} stroke={color.cyan} strokeWidth={2} />
          <Path
            d="M 26 42 l 8 -12 l 7 19 l 7 -14 l 6 7 l 12 0"
            stroke={color.cyan}
            strokeWidth={2.75}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      <Animated.View entering={ZoomIn.delay(750).springify().damping(11)} style={{ position: 'absolute', left: right.x - 30, top: right.y - 30 }}>
        <Svg width={60} height={60} viewBox="0 0 60 60">
          <Circle cx={30} cy={30} r={28} fill={color.panel} stroke={color.line} strokeWidth={1} />
          <Path
            d="M 30 21 c -7 -9 -20 -2 -13 9 c 4 6 13 11 13 13 c 0 -2 9 -7 13 -13 c 7 -11 -6 -18 -13 -9 z"
            fill={color.green}
            opacity={0.9}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
