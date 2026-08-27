import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { PressureProvider } from '@/pressure/PressureProvider';
import { ProfileProvider } from '@/context/ProfileContext';
import { AuthProvider } from '@/context/AuthContext';
import { Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

 useEffect(() => {
 if (loaded || error) {
 SplashScreen.hideAsync();
 }
 }, [loaded, error]);

 if (!loaded && !error) return null;

 return (
 <SafeAreaProvider>
 <StatusBar style="light" />
 <AuthProvider>
 <ProfileProvider>
 <PressureProvider>
 <Stack
 screenOptions={{
 headerShown: false,
 contentStyle: { backgroundColor: color.bg },
 animation: 'fade',
 }}
 >
 <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
 <Stack.Screen name="session-detail" options={{ headerShown: false }} />
 </Stack>
 </PressureProvider>
 </ProfileProvider>
 </AuthProvider>
 </SafeAreaProvider>
 );
}
