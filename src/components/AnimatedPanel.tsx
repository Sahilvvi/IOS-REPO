import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
 FadeInDown,
 FadeInUp,
 FadeIn,
 useAnimatedStyle,
 useSharedValue,
 withSpring,
 withDelay,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { color, font, space, radius } from '@/theme/tokens';

interface AnimatedPanelProps {
 delay?: number;
 gradient?: boolean;
 style?: any;
 children: React.ReactNode;
}

export function AnimatedPanel({ delay = 0, gradient, style, children }: AnimatedPanelProps) {
 return (
 <Animated.View
 entering={FadeInDown.springify().damping(16).delay(delay)}
 style={[styles.panel, gradient && styles.gradient, style]}
 >
 {children}
 </Animated.View>
 );
}

export function AnimatedStatTile({
 label,
 value,
 unit,
 accent = 'cyan',
 delay = 0,
 }: {
 label: string;
 value: string | number;
 unit?: string;
 accent?: string;
 delay?: number;
}) {
 const accentColors: Record<string, string> = {
 cyan: color.cyan,
 red: color.red,
 amber: color.amber,
 green: color.green,
 };

 return (
 <Animated.View
 entering={FadeInUp.springify().damping(16).delay(delay)}
 style={styles.tile}
 >
 <View style={styles.tileLabel}>
 <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accentColors[accent] || color.cyan, marginRight: 6 }} />
 <Text style={styles.tileLabelText}>{label.toUpperCase()}</Text>
 </View>
 <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
 <Text style={[styles.tileValue, { color: accentColors[accent] || color.cyan }]}>
 {typeof value === 'number' ? value.toFixed(1) : value}
 </Text>
 {unit && <Text style={styles.tileUnit}>{unit}</Text>}
 </View>
 </Animated.View>
 );
}

import { Text } from 'react-native';

const styles = StyleSheet.create({
 panel: {
 backgroundColor: color.panel,
 borderWidth: 1,
 borderColor: color.line,
 borderRadius: radius.md,
 padding: space.md,
 },
 gradient: {
 backgroundColor: 'transparent',
 borderColor: 'rgba(0,229,255,0.15)',
 overflow: 'hidden',
 },
 tile: {
 backgroundColor: color.panel,
 borderWidth: 1,
 borderColor: color.line,
 borderRadius: radius.md,
 padding: space.md,
 flex: 1,
 },
 tileLabel: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: 4,
 },
 tileLabelText: {
 fontFamily: 'DM Mono_500Medium',
 fontSize: 9,
 color: color.textFaint,
 letterSpacing: 1,
 },
 tileValue: {
 fontFamily: 'DM Mono_500Medium',
 fontSize: 22,
 },
 tileUnit: {
 fontFamily: 'DM Mono_400Regular',
 fontSize: 10,
 color: color.textFaint,
 marginLeft: 4,
 },
});
