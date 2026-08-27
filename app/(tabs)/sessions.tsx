import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenScaffold, Panel, Lbl, Body, Btn } from '@/components/ui';
import { color, font, space, radius } from '@/theme/tokens';
import { listSessions, formatDuration, formatDate, type SessionMeta, deleteSession } from '@/services/SessionService';

export default function SessionsScreen() {
 const [sessions, setSessions] = useState<SessionMeta[]>([]);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const router = useRouter();

 const load = useCallback(async () => {
 try {
 const data = await listSessions();
 setSessions(data.sort((a, b) => b.startMs - a.startMs));
 } catch {
 setSessions([]);
 } finally {
 setLoading(false);
 setRefreshing(false);
 }
 }, []);

 useFocusEffect(
 useCallback(() => { load(); }, [load])
 );

 const onRefresh = useCallback(async () => {
 setRefreshing(true);
 await load();
 }, [load]);

 const handleDelete = (session: SessionMeta) => {
 Alert.alert(
 'Delete Session',
 `Remove session from ${formatDate(session.startMs)}?`,
 [
 { text: 'Cancel', style: 'cancel' },
 {
 text: 'Delete',
 style: 'destructive',
 onPress: async () => {
 Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
 await deleteSession(session.id);
 load();
 },
 },
 ]
 );
 };

 if (loading) {
 return (
 <ScreenScaffold
 title="Sessions"
 rightAction={
 <TouchableOpacity onPress={() => router.push('/settings')} style={{ padding: 4 }}>
 <Text style={{ color: color.textFaint, fontSize: 16, fontFamily: 'DM Mono_500Medium' }}>⚙</Text>
 </TouchableOpacity>
 }
 >
 <View style={styles.center}>
 <ActivityIndicator size="large" color={color.cyan} />
 <Text style={styles.loadingText}>Loading sessions...</Text>
 </View>
 </ScreenScaffold>
 );
 }

 return (
 <ScreenScaffold
 title={`Sessions (${sessions.length})`}
 rightAction={
 <TouchableOpacity onPress={() => router.push('/settings')} style={{ padding: 4 }}>
 <Text style={{ color: color.textFaint, fontSize: 16, fontFamily: 'DM Mono_500Medium' }}>⚙</Text>
 </TouchableOpacity>
 }
 >
 <ScrollView
 showsVerticalScrollIndicator={false}
 contentContainerStyle={styles.scroll}
 refreshControl={
 <RefreshControl
 refreshing={refreshing}
 onRefresh={onRefresh}
 tintColor={color.cyan}
 />
 }
 >
 {sessions.length === 0 ? (
 <View style={styles.empty}>
 <Text style={styles.emptyIcon}>◧</Text>
 <Text style={styles.emptyTitle}>No Sessions Yet</Text>
 <Text style={styles.emptyText}>
 Complete a wear session to see it listed here. Data is recorded automatically.
 </Text>
 </View>
 ) : (
 sessions.map(session => (
 <TouchableOpacity
 key={session.id}
 activeOpacity={0.7}
 onPress={() => {
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 router.push(`/session-detail?id=${encodeURIComponent(session.id)}`);
 }}
 onLongPress={() => handleDelete(session)}
 >
 <Panel style={styles.sessionCard}>
 <View style={styles.sessionRow}>
 <View style={styles.sessionInfo}>
 <Text style={styles.sessionDate}>{formatDate(session.startMs)}</Text>
 <Text style={styles.sessionDetail}>{formatDuration(session.durationSec)} · {session.rows} samples</Text>
 </View>
 <View style={styles.sessionRight}>
 <Text style={[styles.subjectBadge, { color: color.cyan }]}>{session.subjectId}</Text>
 <Text style={styles.chevron}>{'›'}</Text>
 </View>
 </View>
 </Panel>
 </TouchableOpacity>
 ))
 )}
 </ScrollView>
 </ScreenScaffold>
 );
}

const styles = StyleSheet.create({
 scroll: { paddingBottom: space.xxl },
 center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.md },
 loadingText: { fontFamily: font.mono, fontSize: 12, color: color.textFaint, letterSpacing: 0.5 },
 empty: { paddingVertical: space.xxl * 2, alignItems: 'center' },
 emptyIcon: { fontSize: 48, color: color.textFaint, marginBottom: space.md, opacity: 0.4 },
 emptyTitle: { fontFamily: font.bodyBold, fontSize: 18, color: color.text, marginBottom: space.sm },
 emptyText: { fontFamily: font.body, fontSize: 13, color: color.textDim, textAlign: 'center', lineHeight: 20, maxWidth: 260 },
 sessionCard: { padding: space.md, marginBottom: space.sm },
 sessionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
 sessionInfo: { flex: 1 },
 sessionDate: { fontFamily: font.bodySemi, fontSize: 14, color: color.text, marginBottom: 2 },
 sessionDetail: { fontFamily: font.mono, fontSize: 11, color: color.textFaint },
 sessionRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
 subjectBadge: { fontFamily: font.monoMed, fontSize: 11, letterSpacing: 0.5 },
 chevron: { fontFamily: font.mono, fontSize: 20, color: color.textFaint, fontWeight: '300' },
});
