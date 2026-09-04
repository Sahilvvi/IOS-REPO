import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GlowButton } from '@/components/GlowButton';
import { SensorGridTexture, CornerRing } from '@/components/InstrumentBackdrop';
import { HeroFitRing } from '@/components/HeroFitRing';
import { HeroTrendChart } from '@/components/HeroTrendChart';
import { HeroConnectDiagram } from '@/components/HeroConnectDiagram';
import { useOnboarding } from '@/context/OnboardingContext';
import { color, font, space, APP_MAX_WIDTH } from '@/theme/tokens';

const PAGES = [
  {
    eyebrow: 'REAL-TIME PRESSURE MAPPING',
    title: 'See exactly\nwhat your socket feels.',
    body: 'Eighteen embedded sensors read pressure inside your socket, live — AVA Fit turns it into one clear score.',
    Hero: () => <HeroFitRing size={240} score={84} />,
  },
  {
    eyebrow: 'DAILY TRENDS',
    title: 'See the pattern\nbefore it’s a problem.',
    body: 'Wear time, hot spots, and comfort across the week, tracked automatically — so a bad day doesn’t become a bad month.',
    Hero: () => <HeroTrendChart width={260} height={200} />,
  },
  {
    eyebrow: 'CARE TEAM, CONNECTED',
    title: 'Your prosthetist,\nin the loop.',
    body: 'Share sessions and log how you feel — your care team sees it without you having to explain it.',
    Hero: () => <HeroConnectDiagram width={260} height={190} />,
  },
];

export default function OnboardingScreen() {
  const { complete } = useOnboarding();
  const { width, height } = useWindowDimensions();
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
    <View style={styles.root}>
      <SensorGridTexture width={width} height={height} fade="radial" />
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
          {PAGES.map(({ eyebrow, title, body, Hero }, i) => (
            // Outer page must stay exactly `width` wide — the paging math in
            // onScroll()/goTo() snaps to multiples of it. The capped column
            // lives one level in, so an iPad gets a centered card instead of
            // the hero graphic and copy pinned to the left of a huge page.
            <View key={i} style={[styles.page, { width }]}>
              <View style={styles.pageContent}>
                <View style={styles.heroRow}>
                  <CornerRing size={260} progress={0.24 + i * 0.1} />
                  <View style={styles.heroBleed}>
                    <Hero />
                  </View>
                </View>

                <Animated.Text entering={FadeInDown.delay(80).springify().damping(16)} style={styles.eyebrow}>
                  {eyebrow}
                </Animated.Text>
                <Animated.Text entering={FadeInDown.delay(160).springify().damping(16)} style={styles.title}>
                  {title}
                </Animated.Text>
                <Animated.Text entering={FadeInDown.delay(240).springify().damping(16)} style={styles.body}>
                  {body}
                </Animated.Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerInner}>
          <View style={styles.dots}>
            {PAGES.map((_, i) => (
              <Animated.View key={i} layout={Layout.springify()} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
          <GlowButton
            label={isLast ? 'GET STARTED' : 'NEXT'}
            icon="arrow-forward"
            onPress={next}
            style={{ alignSelf: 'stretch' }}
          />
          {isLast && (
            <Animated.View entering={FadeIn.delay(200)} style={styles.legalRow}>
              <Text style={styles.legal}>Clinical research tool — not a medical device.</Text>
            </Animated.View>
          )}
          </View>
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
  page: { paddingHorizontal: space.xl, paddingTop: space.xxl + space.lg, alignItems: 'center' },
  pageContent: { width: '100%', maxWidth: APP_MAX_WIDTH },
  heroRow: {
    height: 260,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: space.lg,
    overflow: 'visible',
  },
  heroBleed: { marginRight: -36 },
  eyebrow: {
    fontFamily: font.monoMed,
    fontSize: 11,
    letterSpacing: 2.5,
    color: color.cyan,
    marginBottom: space.sm,
  },
  title: {
    fontFamily: font.bodyXbold,
    fontSize: 28,
    color: color.text,
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: space.sm,
    maxWidth: 300,
  },
  body: {
    fontFamily: font.body,
    fontSize: 14,
    color: color.textDim,
    lineHeight: 21,
    maxWidth: 290,
  },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.lg, alignItems: 'center' },
  footerInner: { width: '100%', maxWidth: APP_MAX_WIDTH },
  dots: { flexDirection: 'row', gap: 8, marginBottom: space.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.line },
  dotActive: { backgroundColor: color.cyan, width: 20 },
  legalRow: { alignItems: 'center', marginTop: space.md },
  legal: { fontFamily: font.mono, fontSize: 9, color: color.textFaint },
});
