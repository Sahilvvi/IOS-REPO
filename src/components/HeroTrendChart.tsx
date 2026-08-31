import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Line, Circle, Path } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { color } from '@/theme/tokens';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A bold trend-line hero that draws itself in, rather than a static chart
 * icon — same "instrument coming online" motion language as HeroFitRing. */
export function HeroTrendChart({ width = 300, height = 220 }: { width?: number; height?: number }) {
  const points = [0.82, 0.68, 0.74, 0.5, 0.56, 0.28, 0.4, 0.12];
  const pad = 20;
  const step = (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => ({ x: pad + i * step, y: pad + p * (height - pad * 2) }));
  const path = coords.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');

  // Rough path length estimate for the dash-draw trick — doesn't need to be
  // exact, just >= the real length so the line fully reveals.
  const length = coords.reduce((sum, pt, i) => (i === 0 ? 0 : sum + Math.hypot(pt.x - coords[i - 1].x, pt.y - coords[i - 1].y)), 0) * 1.05;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(250, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - progress.value),
  }));

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0.3, 0.55, 0.8, 1].map((f) => (
          <Line key={f} x1={pad} y1={pad + f * (height - pad * 2)} x2={width - pad} y2={pad + f * (height - pad * 2)} stroke={color.line} strokeWidth={1} />
        ))}
        <AnimatedPath
          d={path}
          stroke={color.cyan}
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={length}
          animatedProps={animatedProps}
        />
        {coords.map((pt, i) => (
          <Circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={i === coords.length - 1 ? 6.5 : 3.5}
            fill={i === coords.length - 1 ? color.cyan : color.panel}
            stroke={color.cyan}
            strokeWidth={2}
          />
        ))}
      </Svg>
    </View>
  );
}
