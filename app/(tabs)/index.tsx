import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFitReading, useClinicalReading, useSession } from '@/pressure/PressureProvider';
import { useProfile } from '@/context/ProfileContext';
import { FitRing, ConnectDeviceCard } from '@/components';
import { Panel, Row, StatTile, Bar, Btn, Lbl, Body, Sub, ScreenScaffold, Dot } from '@/components/ui';
import { color, font, space, radius } from '@/theme/tokens';
import { getTodaySessionStats, listSessions } from '@/services/SessionService';
import { pushSession } from '@/services/CloudSyncService';

export default function TodayScreen() {
 const reading = useFitReading();
 const clinical = useClinicalReading();
 const session = useSession();
 const router = useRouter();
 const { activeProfile } = useProfile();
 const [sessionCount, setSessionCount] = useState(0);
 const [totalHours, setTotalHours] = useState(0);
 const [greeting, setGreeting] = useState('');
 const [toggling, setToggling] = useState(false);

 useEffect(() => {
 (async () => {
 const stats = await getTodaySessionStats();
 setSessionCount(stats.count);
 setTotalHours(stats.totalHours);
 const hour = new Date().getHours();
 const g = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
 setGreeting(activeProfile ? `${g}, ${activeProfile.name}` : `${g}`);
 })();
 }, [activeProfile]);

 useFocusEffect(
 useCallback(() => {
 let c = false;
 (async () => {
 const stats = await getTodaySessionStats();
 if (!c) { setSessionCount(stats.count); setTotalHours(stats.totalHours); }
 })();
 return () => { c = true; };
 }, [])
 );

 const handleToggleSession = async () => {
 if (toggling) return;
 setToggling(true);
 try {
 if (session.active) {
 await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
 const sid = await session.stopSession();
 if (sid && activeProfile) {
 const meta = (await listSessions()).find(s => s.id === sid);
 if (meta) pushSession(meta, activeProfile.id);
 }
 const stats = await getTodaySessionStats();
 setSessionCount(stats.count);
 setTotalHours(stats.totalHours);
 } else {
 await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
 await session.startSession(activeProfile?.patient_id ?? 'unknown');
 }
 } finally {
 setToggling(false);
 }
 };

 const riskLevel = clinical?.overallLevel ?? 'low';
 const riskColor = riskLevel === 'critical' ? color.red : riskLevel === 'high' ? color.red : riskLevel === 'moderate' ? color.amber : color.green;
 const wearHours = totalHours > 0 ? totalHours.toFixed(1) : '0.0';
 const wearTarget = 6;
 const wearProgress = totalHours > 0 ? Math.min(100, (totalHours / wearTarget) * 100) : 0;
 const sessionLabel = sessionCount === 1 ? '1 session today' : `${sessionCount} sessions today`;

 return (
 <ScreenScaffold
 title="Today"
 rightAction={
 <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/settings'); }}>
 <Text style={{ color: color.textFaint, fontSize: 18, fontFamily: 'DM Mono_500Medium' }}>⚙</Text>
 </TouchableOpacity>
 }
 >
 <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
 <View style={styles.welcome}>
 <Text style={styles.greeting}>{greeting}</Text>
 <Text style={styles.greetingSub}>Here is your fit overview</Text>
 </View>

 <ConnectDeviceCard />

 <Panel gradient style={styles.fitCard}>
 <View style={styles.fitRow}>
 <FitRing score={reading.fitScore} level={reading.level} />
 <View style={styles.fitText}>
 <Text style={[styles.fitTag, { color: reading.fitScore > 80 ? color.green : reading.fitScore > 60 ? color.amber : color.red }]}>{reading.tag}</Text>
 <Text style={styles.fitHeadline}>{reading.headline}</Text>
 <Text style={styles.fitSummary}>{reading.summary}</Text>
 </View>
 </View>
 <Btn tone="cyan" onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/fit'); }} style={styles.showBtn}>
 Show me where
 </Btn>
 </Panel>

 {reading.level !== 'comfortable' && (
 <Panel style={styles.alertCard}>
 <View style={styles.alertHeader}>
 <Dot color={riskColor} />
 <Text style={[styles.alertLabel, { color: riskColor }]}>
 {reading.level === 'watch' ? 'WATCH THIS SPOT' : 'PRESSURE ALERT'}
 </Text>
 </View>
 <Text style={styles.alertText}>{reading.hotLabel} is running high right now.</Text>
 <Btn tone="ghost" onPress={() => router.push('/fit')} style={styles.alertBtn}>
 View Details
 </Btn>
 </Panel>
 )}

 <Row style={styles.statsRow}>
 <StatTile label="Peak" value={reading.peak} unit="kPa" accent={reading.peak > 80 ? 'red' : reading.peak > 50 ? 'amber' : 'green'} />
 <StatTile label="Average" value={reading.average} unit="kPa" accent="cyan" />
 <StatTile label="Activity" value={reading.advice.includes('walk') ? 'Active' : 'Rest'} accent="green" />
 </Row>

 {clinical?.available && (
 <Panel style={styles.riskCard}>
 <Lbl>Pressure Injury Risk</Lbl>
 <View style={styles.riskSummary}>
 <View style={[styles.riskPill, { backgroundColor: riskColor + '20', borderColor: riskColor }]}>
 <Text style={[styles.riskPillText, { color: riskColor }]}>{riskLevel.toUpperCase()}</Text>
 </View>
 <Text style={styles.riskSub}>{clinical.window_s}s of data collected</Text>
 </View>
 {clinical.regions.filter(r => r.level !== 'low').slice(0, 2).map((r, i) => (
 <View key={i} style={styles.riskRow}>
 <Text style={styles.riskRegion}>{r.region}</Text>
 <Bar progress={Math.min(100, r.peak_kpa / 1.2)} color={riskColor} />
 </View>
 ))}
 </Panel>
 )}

 <Panel style={styles.wearCard}>
 <Lbl>Today's Wear Time</Lbl>
 <View style={styles.wearRow}>
 <View style={styles.wearCircle}>
 <Text style={styles.wearValue}>{wearHours}</Text>
 <Text style={styles.wearUnit}>hours</Text>
 </View>
 <View style={{ flex: 1, marginLeft: space.md }}>
 <Bar progress={wearProgress} color={color.cyan} />
 <Text style={styles.wearHint}>6h target · {sessionLabel}</Text>
 </View>
 </View>
 <Btn
 tone={session.active ? 'amber' : 'cyan'}
 onPress={handleToggleSession}
 style={styles.sessionBtn}
 >
 {toggling ? 'Please wait…' : session.active ? '■ Stop Session' : '● Start Session'}
 </Btn>
 {session.active && <Text style={styles.recordingHint}>Recording pressure data…</Text>}
 </Panel>

 <Panel style={styles.planCard}>
 <Lbl>Today's Plan</Lbl>
 <View style={styles.planRow}>
 <View style={styles.planDot} />
 <View style={styles.planContent}>
 <Text style={styles.planItem}>Morning walk + clinic check-in</Text>
 <Text style={styles.planTime}>9:00 AM</Text>
 </View>
 <View style={[styles.planCheck, { backgroundColor: color.green + '20', borderColor: color.green }]}>
 <Text style={[styles.planCheckText, { color: color.green }]}>DONE</Text>
 </View>
 </View>
 <View style={styles.planRow}>
 <View style={[styles.planDot, { backgroundColor: color.amber }]} />
 <View style={styles.planContent}>
 <Text style={styles.planItem}>Afternoon wear — watch hot spot</Text>
 <Text style={styles.planTime}>2:00 PM</Text>
 </View>
 <View style={[styles.planCheck, { backgroundColor: color.amber + '20', borderColor: color.amber }]}>
 <Text style={[styles.planCheckText, { color: color.amber }]}>NEXT</Text>
 </View>
 </View>
 </Panel>
 </ScrollView>
 </ScreenScaffold>
 );
}

const styles = StyleSheet.create({
 scroll: { paddingBottom: space.xxl },
 welcome: { paddingVertical: space.md, paddingHorizontal: space.md },
 greeting: { fontFamily: 'Manrope_700Bold', fontSize: 26, color: color.text },
 greetingSub: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: color.textDim, marginTop: 4 },
 fitCard: { padding: space.md, marginBottom: space.md },
 fitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
 fitText: { flex: 1, marginLeft: space.md },
 fitTag: { fontFamily: 'DM Mono_500Medium', fontSize: 10, color: color.textFaint, letterSpacing: 1, marginBottom: 4 },
 fitHeadline: { fontFamily: 'Manrope_700Bold', fontSize: 16, color: color.text, marginBottom: 4 },
 fitSummary: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: color.textDim, lineHeight: 18 },
 showBtn: { alignSelf: 'flex-start' },
 alertCard: { padding: space.md, marginBottom: space.md, backgroundColor: color.red + '08', borderColor: color.red + '30' },
 alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
 alertLabel: { fontFamily: 'DM Mono_500Medium', fontSize: 11, letterSpacing: 1 },
 alertText: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: color.textDim, marginBottom: space.sm },
 alertBtn: { alignSelf: 'flex-start' },
 statsRow: { gap: space.sm, marginBottom: space.md },
 riskCard: { padding: space.md, marginBottom: space.md },
 riskSummary: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
 riskPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
 riskPillText: { fontFamily: 'DM Mono_500Medium', fontSize: 11, letterSpacing: 1 },
 riskSub: { fontFamily: 'DM Mono_400Regular', fontSize: 11, color: color.textFaint, marginLeft: space.sm },
 riskRow: { marginBottom: space.sm },
 riskRegion: { fontFamily: 'Manrope_600SemiBold', fontSize: 12, color: color.text, marginBottom: 4 },
 wearCard: { padding: space.md, marginBottom: space.md },
 wearRow: { flexDirection: 'row', alignItems: 'center' },
 wearCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: color.cyan + '15', borderWidth: 1, borderColor: color.cyan + '30', justifyContent: 'center', alignItems: 'center' },
 wearValue: { fontFamily: 'DM Mono_500Medium', fontSize: 20, color: color.cyan },
 wearUnit: { fontFamily: 'DM Mono_400Regular', fontSize: 9, color: color.textFaint },
 wearHint: { fontFamily: 'DM Mono_400Regular', fontSize: 11, color: color.textFaint, marginTop: 6 },
 sessionBtn: { marginTop: space.md, alignSelf: 'stretch' },
 recordingHint: { fontFamily: 'DM Mono_400Regular', fontSize: 10, color: color.amber, marginTop: 6, textAlign: 'center' },
 planCard: { padding: space.md, marginBottom: space.md },
 planRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
 planDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.green },
 planContent: { flex: 1 },
 planItem: { fontFamily: 'Manrope_400Regular', fontSize: 13, color: color.text },
 planTime: { fontFamily: 'DM Mono_400Regular', fontSize: 10, color: color.textFaint, marginTop: 2 },
 planCheck: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1 },
 planCheckText: { fontFamily: 'DM Mono_500Medium', fontSize: 9, letterSpacing: 0.5 },
});
