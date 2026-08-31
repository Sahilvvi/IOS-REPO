import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { PressureProvider } from '@/pressure/PressureProvider';
import { ProfileProvider } from '@/context/ProfileContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { color } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
 const [loaded, error] = useFonts({
 'Manrope_400Regular': require('@expo-google-fonts/manrope').Manrope_400Regular,
 'Manrope_600SemiBold': require('@expo-google-fonts/manrope').Manrope_600SemiBold,
 'Manrope_700Bold': require('@expo-google-fonts/manrope').Manrope_700Bold,
 'Manrope_800ExtraBold': require('@expo-google-fonts/manrope').Manrope_800ExtraBold,
 'DM Mono_400Regular': require('@expo-google-fonts/dm-mono').DM_Mono_400Regular,
 'DM Mono_500Medium': require('@expo-google-fonts/dm-mono').DM_Mono_500Medium,
 });

 if (!loaded && !error) return null;

 return (
 <SafeAreaProvider>
 <StatusBar style="light" />
 <ErrorBoundary>
 <AuthProvider>
 <OnboardingProvider>
 <ProfileProvider>
 <PressureProvider>
 <Gate />
 </PressureProvider>
 </ProfileProvider>
 </OnboardingProvider>
 </AuthProvider>
 </ErrorBoundary>
 </SafeAreaProvider>
 );
}

/** Holds the native splash up until we know both (a) whether this is a
 * first-ever launch (needs onboarding) and (b) whether there's a signed-in
 * session — then routes to exactly one of onboarding / login / the app via
 * Stack.Protected, which also handles automatically redirecting when either
 * flag flips later (onboarding finishes, sign-in/out happens). */
function Gate() {
 const { session, loading: authLoading } = useAuth();
 const { hasOnboarded } = useOnboarding();
 const ready = !authLoading && hasOnboarded !== null;

 useEffect(() => {
 if (ready) SplashScreen.hideAsync();
 }, [ready]);

 if (!ready) return null;

 return (
 <Stack
 screenOptions={{
 headerShown: false,
 contentStyle: { backgroundColor: color.bg },
 animation: 'fade',
 }}
 >
 <Stack.Protected guard={!hasOnboarded}>
 <Stack.Screen name="onboarding" />
 </Stack.Protected>
 <Stack.Protected guard={!!hasOnboarded && !session}>
 <Stack.Screen name="login" />
 </Stack.Protected>
 <Stack.Protected guard={!!hasOnboarded && !!session}>
 <Stack.Screen name="(tabs)" />
 <Stack.Screen name="session-detail" />
 </Stack.Protected>
 </Stack>
 );
}
