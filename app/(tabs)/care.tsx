import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenScaffold, Panel, Lbl, Body, Btn } from '@/components/ui';
import { color, font, space, radius } from '@/theme/tokens';
import { useProfile } from '@/context/ProfileContext';
import { MOODS as MOODS_DATA } from '@/data/moods';
import { ROSTER } from '@/data/roster';

// moods.ts stores static hex; map to live theme tokens here so mood colors
// stay correct if the theme changes, without duplicating the mood copy.
const MOOD_COLOR: Record<string, string> = { great: color.green, fine: color.cyan, tight: color.amber, sore: color.red };
const MOODS = MOODS_DATA.map(m => ({ ...m, color: MOOD_COLOR[m.id] ?? m.color }));

export default function CareScreen() {
 const router = useRouter();
 const { activeProfile } = useProfile();
 const [mood, setMood] = useState<string | null>(null);
 const [moodHistory, setMoodHistory] = useState<{ mood: string; date: string }[]>([]);

 const handleMoodSelect = (id: string) => {
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 setMood(id);
 setMoodHistory(prev => [{ mood: id, date: new Date().toLocaleString() }, ...prev].slice(0, 10));
 };

 const handleCall = (phone: string, name: string) => {
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 Linking.openURL(`tel:${phone}`).catch(() => {
 Alert.alert('Call Failed', `Could not dial ${name} at ${phone}`);
 });
 };

 const handleMessage = (phone: string, name: string) => {
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 Linking.openURL(`sms:${phone}`).catch(() => {
 Alert.alert('Message Failed', `Could not message ${name}`);
 });
 };

 return (
 <ScreenScaffold
 title="Care"
 rightAction={
 <TouchableOpacity onPress={() => router.push('/settings')} style={{ padding: 4 }}>
 <Text style={{ color: color.textFaint, fontSize: 16, fontFamily: 'DM Mono_500Medium' }}>⚙</Text>
 </TouchableOpacity>
 }
 >
 <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
 <Panel style={styles.clinicianCard}>
 <Lbl>Lead Clinician</Lbl>
 <View style={styles.clinicianRow}>
 <View style={styles.clinicianAvatar}>
 <Text style={styles.avatarText}>VH</Text>
 </View>
 <View style={styles.clinicianInfo}>
 <Text style={styles.clinicianName}>Valerie Hoffman</Text>
 <Text style={styles.clinicianRole}>Lead Prosthetist · Quorum Prosthetics</Text>
 </View>
 </View>
 <View style={styles.clinicianActions}>
 <Btn tone="outline" onPress={() => handleMessage('+1-555-0100', 'Valerie Hoffman')} style={styles.clinBtn}>
 Message
 </Btn>
 <Btn tone="cyan" onPress={() => handleCall('+1-555-0100', 'Valerie Hoffman')} style={styles.clinBtn}>
 Call
 </Btn>
 </View>
 </Panel>

 <Panel style={styles.apptCard}>
 <Lbl>Next Appointment</Lbl>
 <View style={styles.apptRow}>
 <View>
 <Text style={styles.apptDate}>Thursday, 28 August</Text>
 <Text style={styles.apptTime}>10:30 AM · Quorum Prosthetics Clinic</Text>
 </View>
 <View style={[styles.apptBadge, { borderColor: color.cyan }]}>
 <Text style={[styles.apptBadgeText, { color: color.cyan }]}>IN 7 DAYS</Text>
 </View>
 </View>
 <Btn tone="outline" onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)} style={styles.rescheduleBtn}>
 Reschedule
 </Btn>
 </Panel>

 <Panel style={styles.moodCard}>
 <Lbl>How does it feel?</Lbl>
 <View style={styles.moodGrid}>
 {MOODS.map(m => (
 <TouchableOpacity
 key={m.id}
 style={[
 styles.moodBtn,
 mood === m.id && { borderColor: m.color, backgroundColor: m.color + '15' },
 ]}
 onPress={() => handleMoodSelect(m.id)}
 >
 <Text style={styles.moodEmoji}>{m.emoji}</Text>
 <Text style={[styles.moodLabel, { color: mood === m.id ? m.color : color.textDim }]}>
 {m.label}
 </Text>
 </TouchableOpacity>
 ))}
 </View>
 {mood && (
 <View style={[styles.moodNote, { borderColor: MOODS.find(m => m.id === mood)?.color + '30' }]}>
 <Text style={styles.moodNoteText}>
 {MOODS.find(m => m.id === mood)?.note}
 </Text>
 </View>
 )}
 {moodHistory.length > 0 && (
 <View style={styles.moodHistory}>
 <Text style={styles.moodHistoryLabel}>Recent Log</Text>
 {moodHistory.slice(0, 5).map((entry, i) => {
 const m = MOODS.find(mo => mo.id === entry.mood);
 const d = new Date(entry.date);
 const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
 return (
 <View key={i} style={styles.moodHistoryRow}>
 <Text style={styles.moodHistoryEmoji}>{m?.emoji}</Text>
 <Text style={styles.moodHistoryLabel2}>{m?.label}</Text>
 <Text style={styles.moodHistoryDate}>{label}</Text>
 </View>
 );
 })}
 </View>
 )}
 </Panel>

 <Panel style={styles.teamCard}>
 <Lbl>Your Care Team</Lbl>
 {ROSTER.map((member, i) => (
 <View key={i} style={styles.teamRow}>
 <View style={styles.teamAvatar}>
 <Text style={styles.teamAvatarText}>
 {member.name.split(' ').map(n => n[0]).join('')}
 </Text>
 </View>
 <View style={{ flex: 1 }}>
 <Text style={styles.teamName}>{member.name}</Text>
 <Text style={styles.teamRole}>{member.role}</Text>
 </View>
 <Btn tone="ghost" onPress={() => handleCall(member.phone, member.name)}>
 Call
 </Btn>
 </View>
 ))}
 </Panel>

 <Panel style={styles.supportCard}>
 <Lbl>Support</Lbl>
 <TouchableOpacity style={styles.supportRow} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
 <Text style={styles.supportIcon}>📋</Text>
 <View>
 <Text style={styles.supportLabel}>User Guide</Text>
 <Text style={styles.supportDesc}>How to use AVA Fit</Text>
 </View>
 <Text style={styles.supportChevron}>›</Text>
 </TouchableOpacity>
 <View style={styles.divider} />
 <TouchableOpacity style={styles.supportRow} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
 <Text style={styles.supportIcon}>🔒</Text>
 <View>
 <Text style={styles.supportLabel}>Privacy Policy</Text>
 <Text style={styles.supportDesc}>How we handle your data</Text>
 </View>
 <Text style={styles.supportChevron}>›</Text>
 </TouchableOpacity>
 </Panel>
 </ScrollView>
 </ScreenScaffold>
 );
}

const styles = StyleSheet.create({
 scroll: { paddingBottom: space.xxl },
 clinicianCard: { padding: space.md, marginBottom: space.md },
 clinicianRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
 clinicianAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.cyan + '20', borderWidth: 1, borderColor: color.cyan + '40', justifyContent: 'center', alignItems: 'center' },
 avatarText: { fontFamily: 'DM Mono_500Medium', fontSize: 14, color: color.cyan },
 clinicianInfo: { marginLeft: space.md, flex: 1 },
 clinicianName: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: color.text },
 clinicianRole: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: color.textDim, marginTop: 2 },
 clinicianActions: { flexDirection: 'row', gap: space.sm },
 clinBtn: { flex: 1 },
 apptCard: { padding: space.md, marginBottom: space.md },
 apptRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.sm },
 apptDate: { fontFamily: 'Manrope_600SemiBold', fontSize: 15, color: color.text },
 apptTime: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: color.textDim, marginTop: 2 },
 apptBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1, marginLeft: space.sm },
 apptBadgeText: { fontFamily: 'DM Mono_500Medium', fontSize: 10, letterSpacing: 0.5 },
 rescheduleBtn: { alignSelf: 'flex-start' },
 moodCard: { padding: space.md, marginBottom: space.md },
 moodGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
 moodBtn: { flex: 1, alignItems: 'center', padding: space.sm, marginHorizontal: 3, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, backgroundColor: color.panelDeep },
 moodEmoji: { fontSize: 24, marginBottom: 4 },
 moodLabel: { fontFamily: 'DM Mono_500Medium', fontSize: 10, letterSpacing: 0.5 },
 moodNote: { marginTop: space.sm, padding: space.sm, borderRadius: radius.sm, borderWidth: 1 },
 moodNoteText: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: color.textDim, lineHeight: 18 },
 moodHistory: { marginTop: space.md, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color.line },
 moodHistoryLabel: { fontFamily: 'DM Mono_500Medium', fontSize: 10, color: color.textFaint, letterSpacing: 0.5, marginBottom: space.sm },
 moodHistoryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: space.sm },
 moodHistoryEmoji: { fontSize: 18 },
 moodHistoryLabel2: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: color.text, flex: 1 },
 moodHistoryDate: { fontFamily: 'DM Mono_400Regular', fontSize: 10, color: color.textFaint },
 teamCard: { padding: space.md, marginBottom: space.md },
 teamRow: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
 teamAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.panelDeep, borderWidth: 1, borderColor: color.line, justifyContent: 'center', alignItems: 'center' },
 teamAvatarText: { fontFamily: 'DM Mono_500Medium', fontSize: 12, color: color.textDim },
 teamName: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: color.text },
 teamRole: { fontFamily: 'Manrope_400Regular', fontSize: 11, color: color.textDim, marginTop: 1 },
 supportCard: { padding: space.md, marginBottom: space.md },
 supportRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
 supportIcon: { fontSize: 20, width: 32, textAlign: 'center' },
 supportLabel: { fontFamily: 'Manrope_600SemiBold', fontSize: 13, color: color.text },
 supportDesc: { fontFamily: 'Manrope_400Regular', fontSize: 11, color: color.textFaint, marginTop: 1 },
 supportChevron: { fontFamily: 'DM Mono_400Regular', fontSize: 20, color: color.textFaint, fontWeight: '300' },
 divider: { height: 1, backgroundColor: color.line, marginVertical: 4 },
});
