import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { color, font, space, radius, APP_MAX_WIDTH } from '@/theme/tokens';

export function ScreenScaffold({
 title,
 children,
 rightAction,
 }: {
 title: string;
 children: React.ReactNode;
 rightAction?: React.ReactNode;
 }) {
 const { width } = useWindowDimensions();
 const navigation = useNavigation();
 const today = new Date();
 const dateStr = today.toLocaleDateString('en-GB', {
 weekday: 'long',
 day: 'numeric',
 month: 'long',
 }).toUpperCase();

 return (
 <SafeAreaView style={styles.safe} edges={['top']}>
 <LinearGradient colors={[color.panelGradTop, color.panelDeep]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
 <View style={[styles.header, { maxWidth: APP_MAX_WIDTH, width }]}>
 <View>
 <Text style={styles.date}>{dateStr}</Text>
 <Text style={styles.title}>{title}</Text>
 </View>
 <View style={styles.headerRight}>
 <View style={styles.liveDot} />
 <Text style={styles.liveLabel}>SOCKET ON</Text>
 {rightAction}
 </View>
 </View>
 </LinearGradient>
 <View style={[styles.content, { maxWidth: APP_MAX_WIDTH, width }]}>
 {children}
 </View>
 </SafeAreaView>
 );
}

const styles = StyleSheet.create({
 safe: { flex: 1, backgroundColor: color.bg },
 header: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 paddingHorizontal: space.lg,
 paddingTop: space.md,
 paddingBottom: space.md,
 alignSelf: 'center',
 },
 date: {
 fontFamily: font.mono,
 fontSize: 10,
 color: color.textFaint,
 letterSpacing: 1.5,
 marginBottom: 2,
 },
 title: {
 fontFamily: font.bodyBold,
 fontSize: 20,
 color: color.text,
 },
 headerRight: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: 8,
 },
 liveDot: {
 width: 8,
 height: 8,
 borderRadius: 4,
 backgroundColor: color.green,
 },
 liveLabel: {
 fontFamily: font.mono,
 fontSize: 9,
 color: color.green,
 letterSpacing: 1,
 },
 content: {
 flex: 1,
 alignSelf: 'center',
 paddingHorizontal: space.md,
 paddingBottom: space.xl,
 },
});
