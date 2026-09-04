import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GlowButton } from '@/components/GlowButton';
import { SensorGridTexture, CornerRing } from '@/components/InstrumentBackdrop';
import { useAuth } from '@/context/AuthContext';
import { color, font, space, APP_MAX_WIDTH } from '@/theme/tokens';

type Mode = 'signin' | 'signup';

const COPY: Record<Mode, { title: string; sub: string; cta: string; switchLabel: string; switchAction: string }> = {
  signin: {
    title: 'Welcome\nback.',
    sub: "Sign in to check today's fit.",
    cta: 'SIGN IN',
    switchLabel: 'New here?',
    switchAction: 'Create an account',
  },
  signup: {
    title: 'Set up your\naccount.',
    sub: 'One profile, synced across your care team.',
    cta: 'CREATE ACCOUNT',
    switchLabel: 'Already have an account?',
    switchAction: 'Sign in',
  },
};

export default function LoginScreen() {
  const { configured, signIn, signUp } = useAuth();
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);

  const copy = COPY[mode];

  const submit = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords don’t match.');
        return;
      }
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

  const switchMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
    setConfirmSent(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={styles.root}>
      <SensorGridTexture width={width} height={height} fade="top" />
      <SafeAreaView style={styles.safe}>
        {/* `undefined` behavior on Android is a no-op — it relies entirely on
            the OS auto-resizing the window for the keyboard, which app.json's
            `android.edgeToEdgeEnabled: true` breaks (a known interaction:
            edge-to-edge changes how insets are handled and stops the window
            from resizing itself), so on Android the keyboard was covering
            the form with no compensation at all. */}
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Capped and centered so the form reads as a form on an iPad's
                much wider screen, instead of text inputs and buttons
                stretching edge-to-edge — same treatment ScreenScaffold gives
                every post-auth screen. */}
            <View style={styles.formWrap}>
            <View style={styles.heroRow}>
              <CornerRing size={260} progress={mode === 'signin' ? 0.22 : 0.42} />
            </View>

            <View key={mode}>
              <Animated.Text entering={FadeInDown.delay(40).springify().damping(16)} style={styles.eyebrow}>
                AVA FIT{' '}·{' '}SOCKET MONITOR
              </Animated.Text>
              <Animated.Text entering={FadeInDown.delay(100).springify().damping(16)} style={styles.title}>
                {copy.title}
              </Animated.Text>
              <Animated.View entering={FadeInDown.delay(140).springify().damping(16)} style={styles.rule} />
              <Animated.Text entering={FadeInDown.delay(160).springify().damping(16)} style={styles.sub}>
                {copy.sub}
              </Animated.Text>

              {!configured ? (
                <Text style={[styles.error, { marginTop: space.lg }]}>
                  Cloud sync isn't configured for this build — sign-in is unavailable right now.
                </Text>
              ) : confirmSent ? (
                <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.confirmBox}>
                  <Ionicons name="mail-open-outline" size={26} color={color.cyan} style={{ marginBottom: space.sm }} />
                  <Text style={styles.confirmTitle}>Check your email</Text>
                  <Text style={styles.confirmBody}>
                    We sent a confirmation link to {email.trim()}. Tap it, then come back and sign in.
                  </Text>
                  <GlowButton label="BACK TO SIGN IN" icon="arrow-back" onPress={switchMode} style={{ marginTop: space.lg, alignSelf: 'stretch' }} />
                </Animated.View>
              ) : (
                <Animated.View entering={FadeInDown.delay(200).springify().damping(16)} style={{ marginTop: space.xl }}>
                  <Field label="EMAIL" value={email} onChangeText={setEmail} placeholder="you@email.com" keyboardType="email-address" accent={false} />
                  <Field label="PASSWORD" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry accent={mode === 'signin'} />
                  {mode === 'signup' && (
                    <Field label="CONFIRM PASSWORD" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" secureTextEntry accent />
                  )}

                  {error && <Text style={styles.error}>{error}</Text>}

                  <GlowButton
                    label={busy ? 'PLEASE WAIT…' : copy.cta}
                    onPress={submit}
                    disabled={busy}
                    style={{ marginTop: space.lg }}
                  />

                  <Text style={styles.switchRow}>
                    {copy.switchLabel}{' '}
                    <Text style={styles.switchLink} onPress={switchMode}>{copy.switchAction}</Text>
                  </Text>
                </Animated.View>
              )}
            </View>
            </View>
          </ScrollView>

          <Text style={styles.disclaimer}>
            AVA Fit is a clinical research tool. Not a substitute for professional medical assessment.
          </Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType, accent,
}: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  secureTextEntry?: boolean; keyboardType?: 'email-address'; accent: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={[styles.input, accent && styles.inputAccent]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, padding: space.xl, paddingTop: space.xxl + space.lg, alignItems: 'center' },
  formWrap: { width: '100%', maxWidth: APP_MAX_WIDTH },
  heroRow: { height: 0 },
  eyebrow: { fontFamily: font.monoMed, fontSize: 11, letterSpacing: 2.5, color: color.textFaint, marginBottom: space.lg },
  title: { fontFamily: font.bodyXbold, fontSize: 34, lineHeight: 38, color: color.text, letterSpacing: -0.5, maxWidth: 270 },
  rule: { width: 34, height: 2, backgroundColor: color.cyan, marginTop: space.md, marginBottom: space.sm },
  sub: { fontFamily: font.mono, fontSize: 13, color: color.textDim, lineHeight: 19, maxWidth: 260 },
  field: { marginBottom: space.lg },
  fieldLabel: { fontFamily: font.monoMed, fontSize: 10, letterSpacing: 1.5, color: color.textFaint, marginBottom: 8 },
  input: {
    fontFamily: font.body,
    fontSize: 15,
    color: color.text,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
    paddingVertical: 11,
    paddingHorizontal: 2,
  },
  inputAccent: { borderBottomColor: color.cyan },
  error: { fontFamily: font.mono, fontSize: 11, color: color.red, marginBottom: space.md, lineHeight: 16 },
  switchRow: { fontFamily: font.mono, fontSize: 13, color: color.textDim, marginTop: space.lg, letterSpacing: 0.3, lineHeight: 19 },
  switchLink: { color: color.cyan },
  confirmBox: { alignItems: 'center', marginTop: space.xl, paddingVertical: space.md },
  confirmTitle: { fontFamily: font.bodySemi, fontSize: 15, color: color.text, marginBottom: space.sm },
  confirmBody: { fontFamily: font.body, fontSize: 12, color: color.textDim, textAlign: 'center', lineHeight: 18 },
  disclaimer: {
    fontFamily: font.mono,
    fontSize: 9,
    color: color.textFaint,
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
  },
});
