import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { color, font, space, radius, shadow } from '@/theme/tokens';

// Re-exported here because every screen imports it alongside the rest of the
// UI kit from '@/components/ui' — ScreenScaffold lives in its own file, but
// without this re-export every one of those imports silently resolves to
// `undefined` and React throws "Element type is invalid" the instant any
// screen renders.
export { ScreenScaffold } from './ScreenScaffold';

export function Panel({
 gradient,
 padding = space.lg,
 style,
 children,
 }: {
 gradient?: boolean;
 padding?: number;
 style?: StyleProp<ViewStyle>;
 children: React.ReactNode;
 }) {
 const shape: StyleProp<ViewStyle> = [styles.panel, { padding }, style];

 if (gradient) {
 return (
 <LinearGradient
 colors={[color.panelGradTop, color.panelDeep]}
 start={{ x: 0.15, y: 0 }}
 end={{ x: 0.85, y: 1 }}
 style={shape}
 >
 {children}
 </LinearGradient>
 );
 }

 return <View style={shape}>{children}</View>;
}

export const Row = ({ style, ...rest }: any) => (
 <View {...rest} style={[styles.row, style]} />
);

export function Bar({ progress, color: barColor = color.cyan, style }: { progress: number; color?: string; style?: ViewStyle }) {
 return (
 <View style={[styles.track, style]}>
 <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: barColor }]} />
 </View>
 );
}

export function Dot({ color: dotColor = color.cyan }: { color?: string }) {
 return <View style={[styles.dot, { backgroundColor: dotColor }]} />;
}

export function Lbl({ style, ...rest }: any) {
 return <Text {...rest} style={[styles.lbl, style]} />;
}

export function Body({ style, ...rest }: any) {
 return <Text {...rest} style={[styles.body, style]} />;
}

export function Sub({ style, ...rest }: any) {
 return <Text {...rest} style={[styles.sub, style]} />;
}

export function Mono({ style, ...rest }: any) {
 return <Text {...rest} style={[styles.mono, style]} />;
}

export function Heading({ style, ...rest }: any) {
 return <Text {...rest} style={[styles.heading, style]} />;
}

export function Btn({
 tone = 'cyan',
 onPress,
 children,
 style,
 }: {
 tone?: 'cyan' | 'amber' | 'ghost' | 'outline';
 onPress?: () => void;
 children: React.ReactNode;
 style?: StyleProp<ViewStyle>;
 }) {
 // Was a bare <View onTouchEnd={onPress}> — View doesn't support press
 // handling at all, and onTouchEnd only fires for actual touchscreen touch
 // events, never mouse clicks (so every Btn was dead on web/desktop) and
 // isn't reliable even on real touch devices without responder negotiation
 // (a ScrollView ancestor can claim the gesture first). Pressable is the
 // real cross-platform primitive for this.
 const scale = useSharedValue(1);
 const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

 return (
 <Pressable
 onPress={onPress}
 onPressIn={() => { scale.value = withSpring(0.96, { damping: 14, stiffness: 300 }); }}
 onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 300 }); }}
 style={[styles.btnWrap, tone === 'cyan' && shadow.glow, style]}
 >
 <Animated.View
 style={[
 styles.btn,
 tone === 'cyan' && styles.btnCyan,
 tone === 'amber' && styles.btnAmber,
 tone === 'ghost' && styles.btnGhost,
 tone === 'outline' && styles.btnOutline,
 animStyle,
 ]}
 >
 <Text
 style={[
 styles.btnText,
 tone === 'cyan' && styles.btnTextCyan,
 tone === 'amber' && styles.btnTextAmber,
 tone === 'ghost' && styles.btnTextGhost,
 tone === 'outline' && styles.btnTextOutline,
 ]}
 >
 {typeof children === 'string' ? children.toUpperCase() : children}
 </Text>
 </Animated.View>
 </Pressable>
 );
}

export function StatTile({ label, value, unit, accent = 'cyan' }: { label: string; value: string | number; unit?: string; accent?: string }) {
 return (
 <View style={styles.tile}>
 <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
 <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
 <Text style={[styles.tileValue, { color: accent === 'cyan' ? color.cyan : accent === 'red' ? color.red : accent === 'amber' ? color.amber : color.green }]}>
 {typeof value === 'number' ? value.toFixed(1) : value}
 </Text>
 {unit && <Text style={styles.tileUnit}>{unit}</Text>}
 </View>
 </View>
 );
}

const styles = StyleSheet.create({
 panel: {
 backgroundColor: color.panel,
 borderWidth: 1,
 borderColor: color.line,
 borderRadius: radius.md,
 ...shadow.sm,
 },
 row: { flexDirection: 'row' },
 track: {
 height: 4,
 backgroundColor: color.track,
 borderRadius: 2,
 overflow: 'hidden',
 },
 fill: {
 height: '100%',
 borderRadius: 2,
 },
 dot: {
 width: 6,
 height: 6,
 borderRadius: 3,
 },
 lbl: {
 fontFamily: font.mono,
 fontSize: 10,
 fontWeight: '600',
 color: color.textFaint,
 letterSpacing: 1.5,
 textTransform: 'uppercase',
 marginBottom: 6,
 },
 body: {
 fontFamily: font.body,
 fontSize: 13,
 color: color.textDim,
 lineHeight: 18,
 },
 sub: {
 fontFamily: font.body,
 fontSize: 11,
 color: color.textFaint,
 lineHeight: 16,
 },
 mono: {
 fontFamily: font.mono,
 fontSize: 12,
 color: color.text,
 },
 heading: {
 fontFamily: font.bodyBold,
 fontSize: 18,
 color: color.text,
 },
 // No overflow:'hidden' here (unlike the old single-layer version) — RN
 // clips shadow* rendering to a view's own bounds when overflow is hidden
 // on that same view, which would silently kill btnCyan's glow shadow
 // below. `btn` (the inner layer) still carries its own matching
 // borderRadius + background, so corners stay clean either way.
 btnWrap: { borderRadius: radius.md },
 btn: {
 paddingVertical: 12,
 paddingHorizontal: 20,
 borderRadius: radius.md,
 alignItems: 'center',
 justifyContent: 'center',
 overflow: 'hidden',
 },
 btnCyan: { backgroundColor: color.cyan },
 btnAmber: { backgroundColor: color.amber },
 btnGhost: { backgroundColor: 'transparent' },
 btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: color.line },
 btnText: {
 fontFamily: font.mono,
 fontSize: 12,
 fontWeight: '600',
 letterSpacing: 1,
 },
 btnTextCyan: { color: color.cyanInk },
 btnTextAmber: { color: color.amberInk },
 btnTextGhost: { color: color.textDim },
 btnTextOutline: { color: color.textDim },
 tile: {
 backgroundColor: color.panel,
 borderWidth: 1,
 borderColor: color.line,
 borderRadius: radius.md,
 padding: space.md,
 flex: 1,
 ...shadow.sm,
 },
 tileLabel: {
 fontFamily: font.mono,
 fontSize: 9,
 color: color.textFaint,
 letterSpacing: 1,
 marginBottom: 4,
 },
 tileValue: {
 fontFamily: font.mono,
 fontSize: 22,
 fontWeight: '500',
 },
 tileUnit: {
 fontFamily: font.mono,
 fontSize: 10,
 color: color.textFaint,
 marginLeft: 4,
 },
});
