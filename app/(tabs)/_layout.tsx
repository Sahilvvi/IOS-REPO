import { Tabs } from 'expo-router/tabs';
import { Platform, StyleSheet, Text } from 'react-native';
import { color, font, space } from '@/theme/tokens';

const TAB_H = Platform.select({ ios: 88, android: 72, default: 72 });

export default function TabLayout() {
 return (
 <Tabs
 screenOptions={{
 tabBarActiveTintColor: color.cyan,
 tabBarInactiveTintColor: '#4F6192',
 tabBarStyle: {
 backgroundColor: color.panel,
 borderTopColor: color.line,
 borderTopWidth: 1,
 height: TAB_H,
 paddingBottom: Platform.select({ ios: 20, android: 8 }),
 paddingTop: 8,
 },
 tabBarLabelStyle: {
 fontFamily: 'DM Mono_500Medium',
 fontSize: 10,
 letterSpacing: 0.5,
 marginTop: 4,
 },
 headerShown: false,
 }}
 >
 <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color: c }) => <Icon emoji="◉" c={c} /> }} />
 <Tabs.Screen name="fit" options={{ title: 'Fit', tabBarIcon: ({ color: c }) => <Icon emoji="◎" c={c} /> }} />
 <Tabs.Screen name="trends" options={{ title: 'Trends', tabBarIcon: ({ color: c }) => <Icon emoji="◫" c={c} /> }} />
 <Tabs.Screen name="care" options={{ title: 'Care', tabBarIcon: ({ color: c }) => <Icon emoji="♥" c={c} /> }} />
 <Tabs.Screen name="sessions" options={{ title: 'Log', tabBarIcon: ({ color: c }) => <Icon emoji="◧" c={c} /> }} />
 <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color: c }) => <Icon emoji="⚙" c={c} /> }} />
 </Tabs>
 );
}

function Icon({ emoji, c }: { emoji: string; c: string }) {
 return (
 <Text style={{ fontSize: 18, fontFamily: 'DM Mono_500Medium', color: c, opacity: c === color.cyan ? 1 : 0.5 }}>
 {emoji}
 </Text>
 );
}
