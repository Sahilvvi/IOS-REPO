import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Btn } from '@/components/ui';
import { AuroraBackground } from '@/components/AuroraBackground';
import { FitIllustration, TrendsIllustration, ConnectIllustration } from '@/components/OnboardingIllustrations';
import { useOnboarding } from '@/context/OnboardingContext';
import { color, font, space } from '@/theme/tokens';

const PAGES = [
  {
    Illustration: FitIllustration,
    eyebrow: 'REAL-TIME PRESSURE MAPPING',
    title: 'See your fit,\nin real time',
    body: 'Eighteen sensors read pressure inside your socket continuously — AVA Fit turns that into one clear score.',
  },
  {
    Illustration: TrendsIllustration,
    eyebrow: 'DAILY TRENDS',
    title: 'Track comfort\nover time',
    body: 'Wear time, hot spots, and trends across the week — spot what\'s working before it becomes a problem.',
  },
  {
    Illustration: ConnectIllustration,
    eyebrow: 'CARE TEAM, CONNECTED',
    title: 'Stay connected\nto your care team',
    body: 'Share sessions with your prosthetist and log how you feel — all in one place.',
  },
];

export default function OnboardingScreen() {
  const { complete } = useOnboarding();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const isLast = page === PAGES.length - 1;

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [page, fade]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) complete();
    else goTo(page + 1);
  };

  const skip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    complete();
  };

  return (
    <View style={styles.root}>
      <AuroraBackground width={width} height={height} />
      <SafeAreaView style={{ flex: 1 }}>
        {!isLast && (
          <Text style={styles.skip} onPress={skip}>
            SKIP
          </Text>
        )}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          style={{ flex: 1 }}
        >
          {PAGES.map(({ Illustration, eyebrow, title, body }, i) => (
            <View key={i} style={[styles.page, { width }]}>
              <Animated.View style={{ opacity: page === i ? fade : 1, alignItems: 'center' }}>
                <View style={styles.illustrationGlow}>
                  <Illustration />
                </View>
                <Text style={styles.eyebrow}>{eyebrow}</Text>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.body}>{body}</Text>
              </Animated.View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {PAGES.map((_, i) => (
              <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
          <View style={styles.btnShadow}>
            <Btn tone="cyan" onPress={next} style={styles.nextBtn}>
              {isLast ? 'Get Started' : 'Next'}
            </Btn>
          </View>
          {isLast && (
            <View style={styles.legalRow}>
              <Ionicons name="shield-checkmark-outline" size={12} color={color.textFaint} />
              <Text style={styles.legal}>Clinical research tool — not a medical device.</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  skip: {
    position: 'absolute',
    top: space.md,
    right: space.lg,
    zIndex: 1,
    fontFamily: font.monoMed,
    fontSize: 11,
    letterSpacing: 1,
    color: color.textFaint,
    padding: space.sm,
  },
  page: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  illustrationGlow: {
    marginBottom: space.xl,
    shadowColor: color.cyan,
    shadowOpacity: 0.45,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  eyebrow: {
    fontFamily: font.monoMed,
    fontSize: 10,
    letterSpacing: 2,
    color: color.cyan,
    marginBottom: space.sm,
  },
  title: {
    fontFamily: font.bodyXbold,
    fontSize: 26,
    color: color.text,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: space.sm,
  },
  body: {
    fontFamily: font.body,
    fontSize: 14,
    color: color.textDim,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.lg, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8, marginBottom: space.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.line },
  dotActive: { backgroundColor: color.cyan, width: 20 },
  btnShadow: {
    alignSelf: 'stretch',
    shadowColor: color.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  nextBtn: { alignSelf: 'stretch' },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.md },
  legal: { fontFamily: font.mono, fontSize: 9, color: color.textFaint },
});
