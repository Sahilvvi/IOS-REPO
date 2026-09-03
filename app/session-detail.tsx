import React, { useCallback, useEffect, useState } from 'react';
import {
 View,
 Text,
 ScrollView,
 StyleSheet,
 Alert,
 ActivityIndicator,
 useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Svg, Polyline, Defs, LinearGradient as SvgGradient } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ScreenScaffold, Panel, Lbl, Body, Btn, StatTile } from '@/components/ui';
import { color, font, space, radius, APP_MAX_WIDTH } from '@/theme/tokens';
import {
 SessionMeta,
 listSessions,
 readSessionCsv,
 parseCsvRows,
 extractPressureData,
 extractPeakPressure,
 formatDuration,
 formatDate,
 deleteSession,
 exportSession,
} from '@/services/SessionService';

// Guarded lazy require — a native module that fails to link should degrade
// this one feature, not crash the whole screen.
let Sharing: typeof import('expo-sharing') | null = null;
try {
  Sharing = require('expo-sharing');
} catch (e) {
  console.warn('[SessionDetail] expo-sharing unavailable:', e);
}

const CHART_HEIGHT = 120;

export default function SessionDetailScreen() {
 const { id } = useLocalSearchParams<{ id: string }>();
 const router = useRouter();
 // Was a module-level Dimensions.get('window') snapshot of the raw device
 // width — on an iPad that's ~1024px, far wider than the column
 // ScreenScaffold actually renders this screen's content in (capped to
 // APP_MAX_WIDTH), so the chart overflowed its panel. Reactive + capped to
 // match.
 const { width: windowWidth } = useWindowDimensions();
 const chartWidth = Math.min(windowWidth, APP_MAX_WIDTH) - 2 * space.md - 32;
 const [session, setSession] = useState<SessionMeta | null>(null);
 const [loading, setLoading] = useState(true);
 const [peakData, setPeakData] = useState<number[]>([]);
 const [pressureData, setPressureData] = useState<number[][]>([]);

 const load = useCallback(async () => {
 if (!id) return;
 try {
 const list = await listSessions();
 const meta = list.find(s => s.id === id);
 setSession(meta || null);

 if (meta) {
 const raw = await readSessionCsv(id);
 if (raw) {
 const rows = parseCsvRows(raw);
 setPeakData(extractPeakPressure(rows));
 setPressureData(extractPressureData(rows));
 }
 }
 } catch {
 setSession(null);
 } finally {
 setLoading(false);
 }
 }, [id]);

 useEffect(() => {
 load();
 }, [load]);

 const handleExport = async () => {
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 if (!id) return;
 const uri = await exportSession(id);
 if (!uri) {
 Alert.alert('Error', 'Could not export session.');
 return;
 }
 const available = Sharing ? await Sharing.isAvailableAsync() : false;
 if (available && Sharing) {
 await Sharing.shareAsync(uri);
 } else {
 Alert.alert('Export Ready', 'File saved to cache.');
 }
 };

 const handleDelete = () => {
 if (!id || !session) return;
 Alert.alert(
 'Delete Session',
 `Remove session from ${formatDate(session.startMs)}? This cannot be undone.`,
 [
 { text: 'Cancel', style: 'cancel' },
 {
 text: 'Delete',
 style: 'destructive',
 onPress: async () => {
 Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
 await deleteSession(id);
 router.back();
 },
 },
 ]
 );
 };

 if (loading) {
 return (
 <ScreenScaffold title="Session">
 <View style={styles.center}>
 <ActivityIndicator size="large" color={color.cyan} />
 <Text style={styles.loadingText}>Loading session data...</Text>
 </View>
 </ScreenScaffold>
 );
 }

 if (!session) {
 return (
 <ScreenScaffold title="Session">
 <View style={styles.center}>
 <Text style={styles.errorTitle}>Session not found</Text>
 <Btn tone="outline" onPress={() => router.back()} style={styles.backBtn}>
 Back to Sessions
 </Btn>
 </View>
 </ScreenScaffold>
 );
 }

 const avgPressure =
 pressureData.length > 0
 ? pressureData.reduce((sum, row) => {
 return (
 sum +
 row.reduce((s, v) => s + (isNaN(v) ? 0 : v), 0) /
 (row.filter(v => !isNaN(v)).length || 1)
 );
 }, 0) / pressureData.length
 : 0;

 const maxPressure =
 peakData.length > 0 ? Math.max(...peakData) : 0;

 return (
 <ScreenScaffold
 title={`Session`}
 rightAction={
 <Btn
 tone="ghost"
 onPress={handleDelete}
 style={{ paddingHorizontal: 8 }}
 >
 <Text style={{ color: color.red, fontFamily: font.mono, fontSize: 11, letterSpacing: 1 }}>
 DELETE
 </Text>
 </Btn>
 }
 >
 <ScrollView
 showsVerticalScrollIndicator={false}
 contentContainerStyle={styles.scroll}
 >
 {/* Metadata */}
 <Panel style={styles.metaCard}>
 <Lbl>Session Details</Lbl>
 <View style={styles.metaGrid}>
 <MetaItem label="Subject" value={session.subjectId} />
 <MetaItem label="Duration" value={formatDuration(session.durationSec)} />
 <MetaItem label="Samples" value={`${session.rows}`} />
 <MetaItem label="Date" value={formatDate(session.startMs)} />
 <MetaItem label="Source" value="Recorded" />
 {session.notes && <MetaItem label="Notes" value={session.notes} />}
 </View>
 </Panel>

 {/* Pressure chart */}
 {peakData.length > 0 && (
 <Panel style={styles.chartCard}>
 <Lbl>Peak Pressure Over Time</Lbl>
 <View style={styles.chartContainer}>
 <PressureChart data={peakData} width={chartWidth} height={CHART_HEIGHT} />
 </View>
 <View style={styles.chartStats}>
 <Text style={styles.chartStatLabel}>Peak: {maxPressure.toFixed(1)} kPa</Text>
 <Text style={styles.chartStatLabel}>Avg: {avgPressure.toFixed(1)} kPa</Text>
 <Text style={styles.chartStatLabel}>Samples: {peakData.length}</Text>
 </View>
 </Panel>
 )}

 {/* Quick stats */}
 <Panel style={styles.statsCard}>
 <Lbl>Summary</Lbl>
 <View style={styles.statRow}>
 <StatTile label="Peak" value={maxPressure} unit="kPa" accent={maxPressure > 80 ? 'red' : maxPressure > 50 ? 'amber' : 'cyan'} />
 <StatTile label="Average" value={avgPressure} unit="kPa" accent="cyan" />
 </View>
 </Panel>

 {/* Actions */}
 <View style={styles.actions}>
 <Btn
 tone="cyan"
 onPress={handleExport}
 style={{ flex: 1, marginRight: space.sm }}
 >
 <Text style={{ marginRight: 6 }}>⤴</Text> Export
 </Btn>
 <Btn tone="outline" onPress={() => router.back()} style={{ flex: 1 }}>
 Back
 </Btn>
 </View>
 </ScrollView>
 </ScreenScaffold>
 );
}

function MetaItem({ label, value }: { label: string; value: string }) {
 return (
 <View style={styles.metaItem}>
 <Text style={styles.metaLabel}>{label.toUpperCase()}</Text>
 <Text style={styles.metaValue} numberOfLines={1}>
 {value}
 </Text>
 </View>
 );
}

function PressureChart({
 data,
 width,
 height,
}: {
 data: number[];
 width: number;
 height: number;
}) {
 if (data.length < 2) {
 return (
 <View style={[styles.chartContainer, { height }]}>
 <Text style={styles.noData}>Not enough data points</Text>
 </View>
 );
 }

 const padding = 20;
 const maxVal = Math.max(...data) * 1.1;
 const minVal = Math.min(...data) * 0.9;
 const range = maxVal - minVal || 1;

 const points = data.map((v, i) => {
 const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
 const y = height - padding - ((v - minVal) / range) * (height - 2 * padding);
 return `${x},${y}`;
 });

 const areaPoints = `${padding},${height - padding} ${points.join(' ')} ${width - padding},${height - padding}`;

 return (
 <Svg height={height} width={width}>
 <Defs>
 <SvgGradient id="sessionArea" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0" stopColor={color.cyan} stopOpacity="0.2" />
 <stop offset="1" stopColor={color.cyan} stopOpacity="0.0" />
 </SvgGradient>
 </Defs>
 <Polyline
 points={areaPoints}
 fill="url(#sessionArea)"
 stroke="none"
 />
 <Polyline
 points={points.join(' ')}
 fill="none"
 stroke={color.cyan}
 strokeWidth={2}
 strokeLinecap="round"
 strokeLinejoin="round"
 />
 </Svg>
 );
}

const styles = StyleSheet.create({
 scroll: {
 paddingBottom: space.xxl,
 },
 center: {
 flex: 1,
 justifyContent: 'center',
 alignItems: 'center',
 gap: space.md,
 },
 loadingText: {
 fontFamily: font.mono,
 fontSize: 12,
 color: color.textFaint,
 letterSpacing: 0.5,
 },
 errorTitle: {
 fontFamily: font.bodySemi,
 fontSize: 16,
 color: color.text,
 marginBottom: space.md,
 },
 backBtn: {
 marginTop: space.sm,
 },
 metaCard: {
 padding: space.md,
 marginBottom: space.md,
 },
 metaGrid: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 marginTop: space.sm,
 },
 metaItem: {
 width: '50%',
 marginBottom: space.sm,
 },
 metaLabel: {
 fontFamily: font.mono,
 fontSize: 9,
 color: color.textFaint,
 letterSpacing: 1,
 marginBottom: 2,
 },
 metaValue: {
 fontFamily: font.monoMed,
 fontSize: 13,
 color: color.text,
 },
 chartCard: {
 padding: space.md,
 marginBottom: space.md,
 },
 chartContainer: {
 marginTop: space.sm,
 alignItems: 'center',
 },
 chartStats: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 marginTop: space.sm,
 paddingTop: space.sm,
 borderTopWidth: 1,
 borderTopColor: color.line,
 },
 chartStatLabel: {
 fontFamily: font.mono,
 fontSize: 11,
 color: color.textDim,
 },
 noData: {
 fontFamily: font.mono,
 fontSize: 11,
 color: color.textFaint,
 marginTop: space.md,
 },
 statsCard: {
 padding: space.md,
 marginBottom: space.md,
 },
 statRow: {
 flexDirection: 'row',
 marginTop: space.sm,
 gap: space.sm,
 },
 actions: {
 flexDirection: 'row',
 marginTop: space.sm,
 marginBottom: space.md,
 },
});
