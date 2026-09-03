import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { color, font } from '@/theme/tokens';
import { SensorGridTexture } from './InstrumentBackdrop';

const MARK_SIZE = 84;

/** A branded screen shown between the native OS splash (the app icon itself,
 * now the real brand mark) and the real app, while `Gate()` in
 * app/_layout.tsx is still waiting on fonts/auth/onboarding. Replaces a bare
 * `return null`, which read as "nothing happened" between the icon and the
 * app. */
export function BootSplash() {
  const { width, height } = useWindowDimensions();
  const markScale = useSharedValue(0.85);
  const markOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0.15);

  useEffect(() => {
    markOpacity.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    markScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.2)) });
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.15, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, []);

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  return (
    <View style={styles.fill}>
      <SensorGridTexture width={width} height={height} fade="radial" />
      <View style={styles.center}>
        <View style={styles.markWrap}>
          <Animated.View style={[styles.glow, glowStyle]} />
          <Animated.Image
            source={require('../../assets/logo-mark.png')}
            style={[styles.mark, markStyle]}
            resizeMode="contain"
          />
        </View>
        <View style={styles.wordmarkBlock}>
          <Text style={styles.wordmark}>
            AVA <Text style={styles.wordmarkAccent}>FIT</Text>
          </Text>
          <View style={styles.rule} />
          <Text style={styles.tagline}>SOCKET FIT MONITORING</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.bg },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markWrap: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: MARK_SIZE * 1.8,
    height: MARK_SIZE * 1.8,
    borderRadius: (MARK_SIZE * 1.8) / 2,
    backgroundColor: color.cyan,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
  },
  wordmarkBlock: { alignItems: 'center', marginTop: 22 },
  wordmark: {
    fontFamily: font.bodyXbold,
    fontSize: 26,
    letterSpacing: 3,
    color: color.text,
  },
  wordmarkAccent: { color: color.cyan },
  rule: {
    width: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: color.cyan,
    marginTop: 12,
    marginBottom: 12,
    opacity: 0.8,
  },
  tagline: {
    fontFamily: font.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: color.textFaint,
  },
});
