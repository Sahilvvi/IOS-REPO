import { Tabs } from 'expo-router/tabs';
import { Platform } from 'react-native';
import { color } from '@/theme/tokens';
import { TabIcon, TabIconName } from '@/components/TabIcons';

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
 <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ focused }) => <Icon name="today" focused={focused} /> }} />
 <Tabs.Screen name="fit" options={{ title: 'Fit', tabBarIcon: ({ focused }) => <Icon name="fit" focused={focused} /> }} />
 <Tabs.Screen name="trends" options={{ title: 'Trends', tabBarIcon: ({ focused }) => <Icon name="trends" focused={focused} /> }} />
 <Tabs.Screen name="care" options={{ title: 'Care', tabBarIcon: ({ focused }) => <Icon name="care" focused={focused} /> }} />
 <Tabs.Screen name="sessions" options={{ title: 'Log', tabBarIcon: ({ focused }) => <Icon name="sessions" focused={focused} /> }} />
 <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ focused }) => <Icon name="settings" focused={focused} /> }} />
 </Tabs>
 );
}

function Icon({ name, focused }: { name: TabIconName; focused: boolean }) {
 return <TabIcon name={name} focused={focused} />;
}
