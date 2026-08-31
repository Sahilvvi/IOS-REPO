import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Btn } from '@/components/ui';
import { FitIllustration, TrendsIllustration, ConnectIllustration } from '@/components/OnboardingIllustrations';
import { useOnboarding } from '@/context/OnboardingContext';
import { color, font, space } from '@/theme/tokens';

const PAGES = [
  {
    Illustration: FitIllustration,
    title: 'See your fit, in real time',
    body: 'Eighteen sensors read pressure inside your socket continuously — AVA Fit turns that into one clear score.',
  },
  {
    Illustration: TrendsIllustration,
    title: 'Track comfort over time',
    body: 'Daily wear time, hot spots, and trends over the week — spot what\'s working before it becomes a problem.',
  },
  {
    Illustration: ConnectIllustration,
    title: 'Stay connected to your care team',
    body: 'Share sessions with your prosthetist and log how you feel — all in one place.',
  },
];

export default function OnboardingScreen() {
  const { complete } = useOnboarding();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const isLast = page === PAGES.length - 1;

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
    <SafeAreaView style={styles.safe}>
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
        {PAGES.map(({ Illustration, title, body }, i) => (
          <View key={i} style={[styles.page, { width }]}>
            <View style={styles.illustration}>
              <Illustration />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>
        <Btn tone="cyan" onPress={next} style={styles.nextBtn}>
          {isLast ? 'Get Started' : 'Next'}
        </Btn>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
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
  illustration: { marginBottom: space.xl },
  title: {
    fontFamily: font.bodyBold,
    fontSize: 22,
    color: color.text,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  body: {
    fontFamily: font.body,
    fontSize: 14,
    color: color.textDim,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.lg, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8, marginBottom: space.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.line },
  dotActive: { backgroundColor: color.cyan, width: 18 },
  nextBtn: { alignSelf: 'stretch' },
});
