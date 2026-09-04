import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Svg, Rect } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { useRouter } from 'expo-router';
import { ScreenScaffold, Panel, Lbl } from '@/components/ui';
import { GearIcon } from '@/components';
import { color, font, space } from '@/theme/tokens';
import {
 listSessions, formatDuration, readSessionCsv, parseCsvRows, extractPressureData,
 type SessionMeta,
} from '@/services/SessionService';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Same comfort formula derive.ts uses for the live Fit Score — Trends is a
// historical rollup of the exact same math, not a separate invented metric.
function comfortFromPressure(peak: number, average: number): number {
 return Math.max(40, Math.min(99, Math.round(100 - (peak - 55) * 0.7 - Math.max(0, average - 45) * 0.3)));
}

/** Whole-session peak/average from its recorded CSV — one comfort score per
 * session, cheap enough to compute for a week's worth of sessions on-device. */
async function sessionComfortScore(session: SessionMeta): Promise<number | null> {
 const raw = await readSessionCsv(session.id);
 if (!raw) return null;
 const channelRows = extractPressureData(parseCsvRows(raw));
 if (!channelRows.length) return null;
 let peak = 0, sum = 0, count = 0;
 for (const row of channelRows) {
 for (const v of row) {
 if (isNaN(v)) continue;
 if (v > peak) peak = v;
 sum += v; count++;
 }
 }
 if (!count) return null;
 return comfortFromPressure(peak, sum / count);
}

interface DayComfort { score: number | null; sessionCount: number }

export default function TrendsScreen() {
 const router = useRouter();
 const [sessions, setSessions] = useState<SessionMeta[] | undefined>();
 const [weekComfort, setWeekComfort] = useState<DayComfort[]>(DAYS.map(() => ({ score: null, sessionCount: 0 })));
 const [computing, setComputing] = useState(false);

 const load = useCallback(async () => {
 try {
 const data = await listSessions();
 setSessions(data);
 } catch {
 setSessions([]);
 }
 }, []);

 useEffect(() => { load(); }, [load]);

 useFocusEffect(
 useCallback(() => { load(); }, [load])
 );

 // Reads each of the last 7 days' session CSVs and computes a real
 // per-day comfort score from actual recorded pressure — days with no
 // session stay `null` (rendered as an empty gap) instead of a filled-in
 // guess. Capped to the 14 most recent sessions in-window so a very busy
 // week doesn't stall the UI reading dozens of CSVs at once.
 useEffect(() => {
 if (!sessions) return;
 let cancelled = false;
 (async () => {
 setComputing(true);
 const now = new Date();
 const inWindow = sessions
 .filter(s => Math.floor((now.getTime() - s.startMs) / 86400000) <= 6)
 .sort((a, b) => b.startMs - a.startMs)
 .slice(0, 14);

 const byDay: Record<string, number[]> = {};
 const countByDay: Record<string, number> = {};
 for (const s of inWindow) {
 const key = DAYS[new Date(s.startMs).getDay()];
 countByDay[key] = (countByDay[key] ?? 0) + 1;
 const score = await sessionComfortScore(s);
 if (score !== null) (byDay[key] ??= []).push(score);
 }
 if (cancelled) return;

 setWeekComfort(DAYS.map(d => {
 const scores = byDay[d];
 return {
 score: scores?.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
 sessionCount: countByDay[d] ?? 0,
 };
 }));
 setComputing(false);
 })();
 return () => { cancelled = true; };
 }, [sessions]);

 const barW = 24;
 const gap = 12;
 const chartW = DAYS.length * (barW + gap) - gap;
 const chartH = 140;
 const maxScore = 100;

 const totalSessions = sessions?.length ?? 0;
 const recentSessions = sessions?.filter(s => s.startMs > Date.now() - 7 * 86400000) ?? [];
 const avgDuration = recentSessions.length > 0
 ? recentSessions.reduce((sum, s) => sum + s.durationSec, 0) / recentSessions.length / 3600
 : 0;
 const totalTime = recentSessions.reduce((sum, s) => sum + s.durationSec, 0) / 3600;

 const daysWithData = weekComfort.filter(d => d.score !== null);
 const weeklyAvg = daysWithData.length
 ? Math.round(daysWithData.reduce((a, d) => a + (d.score as number), 0) / daysWithData.length)
 : null;

 return (
 <ScreenScaffold
 title="Trends"
 rightAction={
 <TouchableOpacity onPress={() => router.push('/settings')} style={{ padding: 4 }}>
 <GearIcon size={18} />
 </TouchableOpacity>
 }
 >
 <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
 {/* Comfort score bar chart */}
 <Panel style={styles.chartCard}>
 <Lbl>Comfort Score (7 days)</Lbl>
 <Svg height={chartH} width={chartW} style={{ alignSelf: 'center', marginTop: 8 }}>
 {weekComfort.map((d, i) => {
 const hasData = d.score !== null;
 const val = d.score ?? 0;
 const h = hasData ? Math.max(4, (val / maxScore) * (chartH - 20)) : 3;
 const x = i * (barW + gap);
 const y = chartH - h - 16;
 const isLow = hasData && val < 70;
 return (
 <React.Fragment key={i}>
 <Rect
 x={x}
 y={y}
 width={barW}
 height={h}
 rx={4}
 fill={!hasData ? color.line : isLow ? color.amber : color.cyan}
 opacity={hasData ? 0.85 : 0.5}
 />
 <Text style={styles.dayLabel}>{DAYS[i]}</Text>
 {hasData && (
 <View style={{ position: 'absolute', top: y - 16, left: x }}>
 <Text style={[styles.barValue, { color: isLow ? color.amber : color.textFaint }]}>{val}</Text>
 </View>
 )}
 </React.Fragment>
 );
 })}
 </Svg>
 <Text style={styles.updatedLabel}>{computing ? 'Calculating…' : 'From recorded session data'}</Text>
 <View style={styles.avgRow}>
 <Text style={styles.avgLabel}>Weekly avg</Text>
 <Text style={styles.avgValue}>{weeklyAvg !== null ? weeklyAvg : '—'}</Text>
 </View>
 </Panel>

 {/* Limb volume — honest "not available" instead of a fabricated number */}
 <Panel style={styles.volumeCard}>
 <Lbl>Limb Volume</Lbl>
 <View style={styles.volumeEmpty}>
 <Text style={styles.volumeEmptyText}>
 Volume forecasting needs periodic limb circumference measurements, which
 AVA Fit doesn't collect on-device yet. Ask your prosthetist to track this
 during clinic visits, or use the desktop app's Volume Forecast tool.
 </Text>
 </View>
 </Panel>

 {/* Session stats */}
 <Panel style={styles.statsCard}>
 <Lbl>Session Stats</Lbl>
 <View style={styles.statGrid}>
 <Stat label="Wear streak" value={computeStreak(sessions)} />
 <Stat label="Avg session" value={`${avgDuration.toFixed(1)}h`} />
 <Stat label="Sessions" value={totalSessions.toString()} accent />
 <Stat label="Total time" value={`${totalTime.toFixed(1)}h`} />
 </View>
 </Panel>

 {/* Insights */}
 <Panel style={styles.insightsCard}>
 <Lbl>Insights</Lbl>
 {totalSessions === 0 ? (
 <Text style={styles.insightText}>
 No session data yet. Wear your device to start collecting comfort trends
 for personalised insights.
 </Text>
 ) : (
 <>
 <Text style={styles.insightText}>
 {totalSessions} session{totalSessions !== 1 ? 's' : ''} recorded. Total
 wear time is {formatDuration(totalTime * 3600)} across {recentSessions.length} recent
 session{recentSessions.length !== 1 ? 's' : ''}.
 </Text>
 <Text style={styles.insightText}>
 Comfort scores above are computed from each session's actual recorded
 peak and average pressure — days without a gray bar have no session yet.
 </Text>
 </>
 )}
 </Panel>
 </ScrollView>
 </ScreenScaffold>
 );
}

function computeStreak(sessions: SessionMeta[] | undefined): string {
 if (!sessions || sessions.length === 0) return '0 days';

 const days = new Set<string>();
 for (const s of sessions) {
 const d = new Date(s.startMs);
 days.add(d.toISOString().slice(0, 10));
 }

 const now = new Date();
 let streak = 0;
 for (let i = 0; i < 365; i++) {
 const check = new Date(now);
 check.setDate(check.getDate() - i);
 const key = check.toISOString().slice(0, 10);
 if (days.has(key)) {
 streak++;
 } else if (i > 0) {
 break;
 }
 }
 return `${streak} days`;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
 return (
 <View style={styles.statItem}>
 <Text style={[styles.statValue, accent && { color: color.cyan }]}>{value}</Text>
 <Text style={styles.statLabel}>{label}</Text>
 </View>
 );
}

const styles = StyleSheet.create({
 scroll: {
 paddingBottom: space.xxl,
 },
 chartCard: {
 padding: space.md,
 marginBottom: space.md,
 },
 barValue: {
 fontFamily: font.mono,
 fontSize: 10,
 color: color.amber,
 },
 dayLabel: {
 fontFamily: font.mono,
 fontSize: 9,
 color: color.textFaint,
 textAlign: 'center',
 marginTop: 4,
 width: 24,
 },
 updatedLabel: {
 fontFamily: font.mono,
 fontSize: 10,
 color: color.textFaint,
 textAlign: 'right',
 marginTop: 4,
 },
 avgRow: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 marginTop: space.sm,
 paddingTop: space.sm,
 borderTopWidth: 1,
 borderTopColor: color.line,
 },
 avgLabel: {
 fontFamily: font.mono,
 fontSize: 11,
 color: color.textFaint,
 },
 avgValue: {
 fontFamily: font.mono,
 fontSize: 14,
 color: color.cyan,
 },
 volumeCard: {
 padding: space.md,
 marginBottom: space.md,
 },
 volumeEmpty: {
 marginTop: space.sm,
 padding: space.sm,
 borderRadius: 8,
 borderWidth: 1,
 borderColor: color.line,
 backgroundColor: color.panelDeep,
 },
 volumeEmptyText: {
 fontFamily: font.body,
 fontSize: 12,
 color: color.textFaint,
 lineHeight: 18,
 },
 statsCard: {
 padding: space.md,
 marginBottom: space.md,
 },
 statGrid: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 gap: space.sm,
 marginTop: space.sm,
 },
 statItem: {
 width: '48%',
 backgroundColor: color.panelDeep,
 borderRadius: 8,
 padding: space.sm,
 borderWidth: 1,
 borderColor: color.line,
 },
 statValue: {
 fontFamily: font.mono,
 fontSize: 18,
 color: color.textDim,
 },
 statLabel: {
 fontFamily: font.mono,
 fontSize: 9,
 color: color.textFaint,
 marginTop: 2,
 letterSpacing: 0.5,
 },
 insightsCard: {
 padding: space.md,
 marginBottom: space.md,
 },
 insightText: {
 fontFamily: font.body,
 fontSize: 13,
 color: color.textDim,
 lineHeight: 20,
 marginBottom: space.sm,
 },
});
