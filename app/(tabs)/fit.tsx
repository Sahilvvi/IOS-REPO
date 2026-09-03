import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, useWindowDimensions, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFitReading, useClinicalReading, useDevice } from '@/pressure/PressureProvider';
import { useProfile } from '@/context/ProfileContext';
import { FitRing, PressureGrid, SocketViewer } from '@/components';
import { Panel, StatTile, Row, Bar, Btn, Lbl, Body, Sub, ScreenScaffold } from '@/components/ui';
import { color, font, space, radius } from '@/theme/tokens';
import { SENSOR_COUNT, REGIONS, SIDES } from '@/pressure/types';
import { SOCKET_MESH_B64 } from '@/data/socketMesh';
import { decodePackedMesh, base64ToBytes, parseSTL, parseOBJ, type RawMesh, type PreparedMesh } from '@/gl/mesh';
import { buildPreparedMesh } from '@/services/MeshBuilder';
import type { MappingMethod } from '@/services/SensorMapper';

async function loadRawMeshFromUri(uri: string, ext: string): Promise<RawMesh | null> {
 try {
 if (ext === 'obj') {
 const text = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
 return parseOBJ(text);
 }
 const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
 const bytes = base64ToBytes(b64);
 const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
 return parseSTL(buf);
 } catch (e) {
 console.warn('[fit] failed to load socket mesh:', e);
 return null;
 }
}

export default function FitScreen() {
 const reading = useFitReading();
 const clinical = useClinicalReading();
 const device = useDevice();
 const router = useRouter();
 const { width } = useWindowDimensions();
 const { activeProfile, updateActiveProfile } = useProfile();
 const [mesh, setMesh] = useState<PreparedMesh | null>(null);

 const grid = activeProfile?.grid ?? { rows: 3, cols: 6 };
 const mappingMethod: MappingMethod = (activeProfile?.mapping?.method as MappingMethod) ?? 'cylindrical';

 // Builds the actual mesh the 3D viewer draws: this patient's imported socket
 // scan if they have one, else the bundled default — either way run through
 // the chosen sensor-mapping method + grid so Settings' pickers have a
 // visible effect instead of being write-only.
 useEffect(() => {
 let cancelled = false;
 (async () => {
 let raw: RawMesh | null = null;
 if (activeProfile?.socket_uri) {
 const ext = (activeProfile.socket_name?.split('.').pop() || 'stl').toLowerCase();
 raw = await loadRawMeshFromUri(activeProfile.socket_uri, ext);
 }
 if (!raw) {
 try { raw = decodePackedMesh(SOCKET_MESH_B64); } catch { raw = null; }
 }
 if (!raw) { if (!cancelled) setMesh(null); return; }

 const built = buildPreparedMesh(raw, {
 method: mappingMethod,
 rows: grid.rows,
 cols: grid.cols,
 coverage: activeProfile?.mapping?.coverage,
 offset: activeProfile?.mapping?.offset,
 });
 if (!cancelled) setMesh(built);
 })();
 return () => { cancelled = true; };
 }, [activeProfile?.socket_uri, activeProfile?.socket_name, grid.rows, grid.cols, mappingMethod, activeProfile?.mapping?.coverage, activeProfile?.mapping?.offset]);

 const risk = clinical?.regions?.[0];
 const riskColor = risk?.level === 'critical' ? color.red : risk?.level === 'high' ? color.red : risk?.level === 'moderate' ? color.amber : color.green;

 return (
 <ScreenScaffold
 title="Fit"
 rightAction={
 <TouchableOpacity onPress={() => router.push('/settings')} style={{ padding: 4 }}>
 <Text style={{ color: color.textFaint, fontSize: 16, fontFamily: 'DM Mono_500Medium' }}>⚙</Text>
 </TouchableOpacity>
 }
 >
 <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
 {/* Header section */}
 <Panel style={styles.headerPanel}>
 <View style={styles.headerRow}>
 <FitRing score={reading.fitScore} level={reading.level} />
 <View style={styles.headerText}>
 <Text style={styles.headline}>{reading.headline}</Text>
 <Text style={styles.advice}>{reading.advice}</Text>
 </View>
 </View>
 </Panel>

 {/* 3D socket viewer */}
 <Panel style={styles.viewerPanel} padding={0}>
 <SocketViewer
 mesh={mesh}
 frame={reading.frame}
 hotIndex={reading.hotIndex}
 showSensors
 height={240}
 />
 <View style={styles.viewerHint}>
 <Text style={styles.viewerHintText}>Drag to rotate · pinch to zoom</Text>
 </View>
 </Panel>

 {/* Stats row */}
 <Row style={styles.statsRow}>
 <StatTile label="Peak" value={reading.peak} unit="kPa" accent={reading.peak > 80 ? 'red' : reading.peak > 50 ? 'amber' : 'cyan'} />
 <StatTile label="Average" value={reading.average} unit="kPa" accent="cyan" />
 <StatTile label="Hot Cell" value={reading.hotLabel} accent={reading.level === 'comfortable' ? 'green' : 'amber'} />
 </Row>

 {/* Risk section */}
 {clinical?.available && (
 <AnimatedPanel style={styles.riskPanel}>
 <Lbl>Pressure Injury Risk</Lbl>
 <View style={styles.riskHeader}>
 <View style={[styles.riskPill, { backgroundColor: riskColor + '20', borderColor: riskColor }]}>
 <Text style={[styles.riskPillText, { color: riskColor }]}>
 {clinical.overallLevel.toUpperCase()}
 </Text>
 </View>
 <Text style={styles.riskWindow}>{clinical.window_s}s window</Text>
 </View>
 {clinical.regions.slice(0, 2).map((region, i) => (
 <View key={i} style={styles.riskRow}>
 <Text style={styles.riskRegion}>{region.region}</Text>
 <View style={styles.riskBars}>
 {region.factors.slice(0, 2).map((factor: string, j: number) => (
 <View key={j} style={styles.factorRow}>
 <Bar progress={Math.min(100, region.peak_kpa / 1.2)} color={riskColor} />
 <Text style={styles.factorText} numberOfLines={1}>{factor}</Text>
 </View>
 ))}
 </View>
 </View>
 ))}
 </AnimatedPanel>
 )}

 {/* Suggestions */}
 {clinical?.suggestions?.length > 0 && (
 <Panel style={styles.suggestionsPanel}>
 <Lbl>Fit Suggestions</Lbl>
 {clinical.suggestions.filter(s => s.action !== 'monitor').slice(0, 3).map((s, i) => (
 <View key={i} style={styles.suggestionRow}>
 <View style={[
 styles.suggestionBadge,
 s.action === 'relieve' ? styles.badgeRelieve : styles.badgeSupport,
 ]}>
 <Text style={[
 styles.suggestionBadgeText,
 s.action === 'relieve' ? styles.textRelieve : styles.textSupport,
 ]}>
 {s.action === 'relieve' ? 'RELIEVE' : 'SUPPORT'}
 </Text>
 </View>
 <Text style={styles.suggestionRegion}>{s.region}</Text>
 <Text style={styles.suggestionNote} numberOfLines={2}>{s.note}</Text>
 </View>
 ))}
 </Panel>
 )}

 {/* Sensor grid */}
 <Panel style={styles.gridPanel}>
 <Lbl>Sensor Grid ({reading.frame.length} sensors)</Lbl>
 <View style={styles.legendRow}>
 {['0', '25', '50', '75', 'kPa'].map((label, i) => (
 <Text key={i} style={styles.legendLabel}>{label}</Text>
 ))}
 </View>
 <PressureGrid frame={reading.frame} maxKpa={reading.level === 'ease-off' ? 100 : 50} hotIndex={reading.hotIndex} rows={grid.rows} cols={grid.cols} />
 </Panel>

 {/* Action buttons */}
 {(activeProfile?.ply_count ?? 0) > 0 && (
 <Text style={styles.plyHint}>
 {activeProfile!.ply_count} sock {activeProfile!.ply_count === 1 ? 'ply' : 'plies'} added
 </Text>
 )}
 <Row style={styles.actionsRow}>
 <Btn tone="cyan" onPress={async () => {
 await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
 const next = (activeProfile?.ply_count ?? 0) + 1;
 await updateActiveProfile({ ply_count: next });
 Alert.alert(
 'Sock Ply Added',
 `Now tracking ${next} ${next === 1 ? 'ply' : 'plies'}. Adding a ply changes your baseline — re-zero once it settles.`,
 );
 }}>
 Add Sock Ply
 </Btn>
 <Btn tone="ghost" onPress={async () => {
 device.zeroCalibrate();
 await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
 Alert.alert('Zeroed', 'Current sensor readings captured as the new baseline.');
 }}>
 Re-zero Fit
 </Btn>
 </Row>

 <Text style={styles.disclaimer}>
 Clinical use disclaimer: This is a research tool. Not a substitute for professional clinical assessment.
 </Text>
 </ScrollView>
 </ScreenScaffold>
 );
}

function AnimatedPanel({ style, children }: { style: any; children: React.ReactNode }) {
 return (
 <View style={[style]}>
 {children}
 </View>
 );
}

const styles = StyleSheet.create({
 scroll: {
 paddingBottom: space.xxl,
 },
 headerPanel: {
 padding: space.md,
 marginBottom: space.md,
 },
 viewerPanel: {
 marginBottom: space.md,
 overflow: 'hidden',
 },
 viewerHint: {
 paddingVertical: 6,
 alignItems: 'center',
 },
 viewerHintText: {
 fontFamily: 'DM Mono_400Regular',
 fontSize: 9,
 color: color.textFaint,
 letterSpacing: 0.5,
 },
 headerRow: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: space.md,
 },
 headerText: {
 flex: 1,
 },
 headline: {
 fontFamily: 'Manrope_700Bold',
 fontSize: 16,
 color: color.text,
 marginBottom: 4,
 },
 advice: {
 fontFamily: 'Manrope_400Regular',
 fontSize: 12,
 color: color.textDim,
 lineHeight: 18,
 },
 statsRow: {
 gap: space.sm,
 marginBottom: space.md,
 },
 riskPanel: {
 padding: space.md,
 marginBottom: space.md,
 },
 riskHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: space.sm,
 },
 riskPill: {
 paddingHorizontal: 12,
 paddingVertical: 4,
 borderRadius: radius.pill,
 borderWidth: 1,
 },
 riskPillText: {
 fontFamily: 'DM Mono_500Medium',
 fontSize: 11,
 letterSpacing: 1,
 },
 riskWindow: {
 fontFamily: 'DM Mono_400Regular',
 fontSize: 11,
 color: color.textFaint,
 marginLeft: space.sm,
 },
 riskRow: {
 marginBottom: space.sm,
 },
 riskRegion: {
 fontFamily: 'Manrope_600SemiBold',
 fontSize: 13,
 color: color.text,
 marginBottom: 4,
 },
 riskBars: { gap: 4 },
 factorRow: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: space.sm,
 },
 factorText: {
 fontFamily: 'DM Mono_400Regular',
 fontSize: 10,
 color: color.textDim,
 flex: 1,
 },
 suggestionsPanel: {
 padding: space.md,
 marginBottom: space.md,
 },
 suggestionRow: {
 flexDirection: 'row',
 alignItems: 'center',
 gap: space.sm,
 marginBottom: space.sm,
 },
 suggestionBadge: {
 paddingHorizontal: 8,
 paddingVertical: 3,
 borderRadius: 4,
 },
 badgeRelieve: { backgroundColor: color.red + '20' },
 badgeSupport: { backgroundColor: color.cyan + '20' },
 suggestionBadgeText: {
 fontFamily: 'DM Mono_500Medium',
 fontSize: 9,
 letterSpacing: 0.5,
 },
 textRelieve: { color: color.red },
 textSupport: { color: color.cyan },
 suggestionRegion: {
 fontFamily: 'Manrope_600SemiBold',
 fontSize: 12,
 color: color.text,
 minWidth: 90,
 },
 suggestionNote: {
 fontFamily: 'Manrope_400Regular',
 fontSize: 11,
 color: color.textDim,
 flex: 1,
 },
 gridPanel: {
 padding: space.md,
 marginBottom: space.md,
 },
 legendRow: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 marginBottom: 4,
 },
 legendLabel: {
 fontFamily: 'DM Mono_400Regular',
 fontSize: 9,
 color: color.textFaint,
 },
 plyHint: {
 fontFamily: font.mono,
 fontSize: 10,
 color: color.textFaint,
 marginBottom: space.sm,
 textAlign: 'center',
 },
 actionsRow: {
 gap: space.sm,
 marginBottom: space.md,
 },
 disclaimer: {
 fontFamily: 'DM Mono_400Regular',
 fontSize: 9,
 color: color.textFaint,
 textAlign: 'center',
 lineHeight: 14,
 },
});
