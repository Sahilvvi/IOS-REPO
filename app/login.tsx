import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Panel, Btn } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { color, font, space, radius } from '@/theme/tokens';

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const { configured, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

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
    setMode(next);
    setError(null);
    setConfirmSent(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[color.panelGradTop, color.bg]} style={StyleSheet.absoluteFill} />
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
            <View style={styles.brand}>
              <View style={styles.mark}>
                <Text style={styles.markText}>AF</Text>
              </View>
              <Text style={styles.appName}>AVA Fit</Text>
              <Text style={styles.tagline}>Prosthetic socket fit, monitored in real time</Text>
            </View>

            <Panel gradient style={styles.card}>
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
                  <Text style={styles.confirmTitle}>Check your email</Text>
                  <Text style={styles.confirmBody}>
                    We sent a confirmation link to {email.trim()}. Tap it, then come back and sign in.
                  </Text>
                  <Btn tone="cyan" onPress={() => switchMode('signin')} style={{ marginTop: space.md }}>
                    Back to Sign In
                  </Btn>
                </View>
              ) : (
                <>
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
                  <View style={{ height: space.sm }} />
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={color.textFaint}
                    secureTextEntry
                    style={styles.input}
                  />
                  {error && <Text style={styles.error}>{error}</Text>}
                  <Btn tone="cyan" onPress={submit} style={{ marginTop: space.md }}>
                    {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
                  </Btn>
                </>
              )}
            </Panel>

            <Text style={styles.disclaimer}>
              AVA Fit is a clinical research tool. Not a substitute for professional medical assessment.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <Text
        onPress={onPress}
        style={[styles.tab, active && styles.tabActive]}
      >
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
  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    backgroundColor: color.cyan + '15',
    borderWidth: 1,
    borderColor: color.cyan + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  markText: { fontFamily: font.bodyXbold, fontSize: 20, color: color.cyan, letterSpacing: 1 },
  appName: { fontFamily: font.bodyBold, fontSize: 24, color: color.text },
  tagline: { fontFamily: font.body, fontSize: 13, color: color.textDim, marginTop: 6, textAlign: 'center' },
  card: { padding: space.lg },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: color.panelDeep,
    borderRadius: radius.sm,
    padding: 4,
    marginBottom: space.lg,
  },
  tab: {
    fontFamily: font.monoMed,
    fontSize: 11,
    letterSpacing: 0.5,
    color: color.textFaint,
    textAlign: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm - 4,
    overflow: 'hidden',
  },
  tabActive: { backgroundColor: color.cyan, color: color.cyanInk },
  input: {
    fontFamily: font.mono,
    fontSize: 13,
    color: color.text,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.panelDeep,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 12,
  },
  error: {
    fontFamily: font.mono,
    fontSize: 11,
    color: color.red,
    marginTop: space.sm,
    lineHeight: 16,
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
