import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { color, font } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The instrument-panel primary action: a cyan pill with a mono tracked
 * label, a trailing arrow, and a real spring press-in (not just an opacity
 * fade) — the button used across splash/onboarding/login. */
export function GlowButton({
  label,
  onPress,
  icon = 'arrow-forward',
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => { scale.value = withSpring(0.96, { damping: 14, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 200 }); }}
      style={[styles.wrap, disabled && styles.disabled, animStyle, style]}
    >
      <Text style={styles.label}>{label}</Text>
      <Ionicons name={icon} size={14} color={color.cyanInk} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 52,
    borderRadius: 26,
    backgroundColor: color.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: color.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  disabled: { opacity: 0.5 },
  label: {
    fontFamily: font.monoMed,
    fontSize: 12,
    letterSpacing: 2,
    color: color.cyanInk,
  },
});
