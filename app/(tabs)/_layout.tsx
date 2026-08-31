import { Tabs } from 'expo-router/tabs';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color } from '@/theme/tokens';

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
 <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color: c, focused }) => <Icon name={focused ? 'home' : 'home-outline'} c={c} /> }} />
 <Tabs.Screen name="fit" options={{ title: 'Fit', tabBarIcon: ({ color: c, focused }) => <Icon name={focused ? 'body' : 'body-outline'} c={c} /> }} />
 <Tabs.Screen name="trends" options={{ title: 'Trends', tabBarIcon: ({ color: c, focused }) => <Icon name={focused ? 'stats-chart' : 'stats-chart-outline'} c={c} /> }} />
 <Tabs.Screen name="care" options={{ title: 'Care', tabBarIcon: ({ color: c, focused }) => <Icon name={focused ? 'heart' : 'heart-outline'} c={c} /> }} />
 <Tabs.Screen name="sessions" options={{ title: 'Log', tabBarIcon: ({ color: c, focused }) => <Icon name={focused ? 'list' : 'list-outline'} c={c} /> }} />
 <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color: c, focused }) => <Icon name={focused ? 'settings' : 'settings-outline'} c={c} /> }} />
 </Tabs>
 );
}

function Icon({ name, c }: { name: keyof typeof Ionicons.glyphMap; c: string }) {
 return <Ionicons name={name} size={22} color={c} style={{ opacity: c === color.cyan ? 1 : 0.6 }} />;
}
