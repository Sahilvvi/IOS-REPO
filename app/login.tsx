import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Btn } from '@/components/ui';
import { AuroraBackground } from '@/components/AuroraBackground';
import { useAuth } from '@/context/AuthContext';
import { color, font, space, radius } from '@/theme/tokens';

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const { configured, signIn, signUp } = useAuth();
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const submit = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const res = mode === 'signin'
      ? await signIn(trimmedEmail, password)
      : await signUp(trimmedEmail, password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Something went wrong.');
      return;
    }
    // Successful signIn flips `session` reactively and app/_layout.tsx swaps
    // this screen out on its own — nothing to navigate here. A successful
    // signUp with email confirmation enabled leaves `session` null until the
    // user clicks the emailed link, so surface that explicitly instead of
    // silently sitting on the same screen with no feedback.
    if (mode === 'signup') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmSent(true);
    }
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setConfirmSent(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.root}>
      <AuroraBackground width={width} height={height} />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
              <View style={styles.brand}>
                <View style={styles.markGlow}>
                  <View style={styles.markRing}>
                    <View style={styles.mark}>
                      <Ionicons name="pulse" size={30} color={color.cyan} />
                    </View>
                  </View>
                </View>
                <Text style={styles.appName}>AVA Fit</Text>
                <Text style={styles.tagline}>Prosthetic socket fit, monitored in real time</Text>
              </View>

              <View style={styles.card}>
                <View style={styles.tabRow}>
                  <ModeTab label="Sign In" active={mode === 'signin'} onPress={() => switchMode('signin')} />
                  <ModeTab label="Create Account" active={mode === 'signup'} onPress={() => switchMode('signup')} />
                </View>

                {!configured ? (
                  <Text style={styles.error}>
                    Cloud sync isn't configured for this build — sign-in is unavailable right now.
                  </Text>
                ) : confirmSent ? (
                  <View style={styles.confirmBox}>
                    <Ionicons name="mail-open-outline" size={28} color={color.cyan} style={{ marginBottom: space.sm }} />
                    <Text style={styles.confirmTitle}>Check your email</Text>
                    <Text style={styles.confirmBody}>
                      We sent a confirmation link to {email.trim()}. Tap it, then come back and sign in.
                    </Text>
                    <Btn tone="cyan" onPress={() => switchMode('signin')} style={{ marginTop: space.md, alignSelf: 'stretch' }}>
                      Back to Sign In
                    </Btn>
                  </View>
                ) : (
                  <>
                    <View style={styles.inputRow}>
                      <Ionicons name="mail-outline" size={17} color={color.textFaint} style={styles.inputIcon} />
                      <TextInput
                        value={email}
                        onChangeText={setEmail}
                        placeholder="Email"
                        placeholderTextColor={color.textFaint}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        style={styles.input}
                      />
                    </View>
                    <View style={{ height: space.sm }} />
                    <View style={styles.inputRow}>
                      <Ionicons name="lock-closed-outline" size={17} color={color.textFaint} style={styles.inputIcon} />
                      <TextInput
                        value={password}
                        onChangeText={setPassword}
                        placeholder="Password"
                        placeholderTextColor={color.textFaint}
                        secureTextEntry
                        style={styles.input}
                      />
                    </View>
                    {error && (
                      <View style={styles.errorRow}>
                        <Ionicons name="alert-circle-outline" size={13} color={color.red} />
                        <Text style={styles.error}>{error}</Text>
                      </View>
                    )}
                    <View style={styles.btnShadow}>
                      <Btn tone="cyan" onPress={submit} style={{ marginTop: space.md }}>
                        {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                      </Btn>
                    </View>
                  </>
                )}
              </View>

              <Text style={styles.disclaimer}>
                AVA Fit is a clinical research tool. Not a substitute for professional medical assessment.
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.lg },
  brand: { alignItems: 'center', marginBottom: space.xl },
  markGlow: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: color.cyan + '14',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  markRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    borderColor: color.cyan + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: color.panelGradTop,
    borderWidth: 1,
    borderColor: color.cyan + '80',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: color.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  appName: { fontFamily: font.bodyXbold, fontSize: 26, color: color.text, letterSpacing: 0.3 },
  tagline: { fontFamily: font.body, fontSize: 13, color: color.textDim, marginTop: 6, textAlign: 'center', maxWidth: 260 },
  card: {
    padding: space.lg,
    backgroundColor: color.panel + 'F2',
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: color.panelDeep,
    borderRadius: radius.sm + 2,
    padding: 4,
    marginBottom: space.lg,
  },
  tab: {
    fontFamily: font.monoMed,
    fontSize: 11,
    letterSpacing: 0.5,
    color: color.textFaint,
    textAlign: 'center',
    paddingVertical: 11,
    borderRadius: radius.sm - 2,
    overflow: 'hidden',
  },
  tabActive: {
    backgroundColor: color.cyan,
    color: color.cyanInk,
    fontFamily: font.monoMed,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.panelDeep,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontFamily: font.mono,
    fontSize: 13,
    color: color.text,
    paddingVertical: 13,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  error: {
    fontFamily: font.mono,
    fontSize: 11,
    color: color.red,
    lineHeight: 16,
  },
  btnShadow: {
    shadowColor: color.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  confirmBox: { alignItems: 'center', paddingVertical: space.sm },
  confirmTitle: { fontFamily: font.bodySemi, fontSize: 15, color: color.text, marginBottom: space.sm },
  confirmBody: { fontFamily: font.body, fontSize: 12, color: color.textDim, textAlign: 'center', lineHeight: 18 },
  disclaimer: {
    fontFamily: font.mono,
    fontSize: 10,
    color: color.textFaint,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: space.xl,
  },
});
