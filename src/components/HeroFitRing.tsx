import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withDelay, withTiming, Easing } from 'react-native-reanimated';
import { color, font } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The onboarding hero — the app's real Fit Ring, blown up large and
 * animated drawing itself in on mount, instead of a static decorative icon.
 * Score counts up in sync with the stroke so the whole thing reads as one
 * live instrument coming online, not a picture of one. */
export function HeroFitRing({ size = 260, score = 84, label = 'COMFORTABLE' }: { size?: number; score?: number; label?: string }) {
  const c = size / 2;
  const r = size * 0.4;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    progress.value = withDelay(200, withTiming(score / 100, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    const start = Date.now();
    const duration = 1100;
    let raf: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start - 200) / duration);
      if (t < 0) { raf = requestAnimationFrame(tick); return; }
      setDisplayScore(Math.round(score * t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={c} cy={c} r={r} stroke={color.line} strokeWidth={size * 0.047} fill="none" />
        <AnimatedCircle
          cx={c} cy={c} r={r}
          stroke={color.cyan}
          strokeWidth={size * 0.047}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${c},${c}`}
        />
        <Line x1={c} y1={size * 0.076} x2={c} y2={size * 0.11} stroke={color.textDim} strokeWidth={1.5} opacity={0.55} />
        <Line x1={c} y1={size * 0.89} x2={c} y2={size * 0.924} stroke={color.textDim} strokeWidth={1.5} opacity={0.55} />
        <Line x1={size * 0.076} y1={c} x2={size * 0.11} y2={c} stroke={color.textDim} strokeWidth={1.5} opacity={0.55} />
        <Line x1={size * 0.89} y1={c} x2={size * 0.924} y2={c} stroke={color.textDim} strokeWidth={1.5} opacity={0.55} />
        <Circle cx={c} cy={size * 0.276} r={size * 0.017} fill={color.green} />
        <Circle cx={c} cy={size * 0.724} r={size * 0.017} fill={color.amber} />
      </Svg>
      <View style={styles.readout} pointerEvents="none">
        <Text style={[styles.score, { fontSize: size * 0.24 }]}>{displayScore}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontFamily: font.monoMed,
    color: color.text,
    letterSpacing: -1,
  },
  label: {
    fontFamily: font.monoMed,
    fontSize: 11,
    color: color.green,
    letterSpacing: 2,
    marginTop: 4,
  },
});
