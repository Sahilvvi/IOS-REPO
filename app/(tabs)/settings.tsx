import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenScaffold, Panel, Lbl, Btn, Row, StatTile, PressureGrid } from '@/components';
import { color, font, space, radius } from '@/theme/tokens';
import { DEVICE_NAMES, useDevice, useFitReading } from '@/pressure/PressureProvider';
import { listSessions, getTodaySessionStats } from '@/services/SessionService';
import { useProfile } from '@/context/ProfileContext';
import { useAuth } from '@/context/AuthContext';
import { importSocketFile, clearSocketFile, type Profile } from '@/services/ProfileService';
import type { MappingMethod } from '@/services/SensorMapper';

// Guarded lazy require — see SocketViewer.native.tsx for why: a native
// module that fails to link should degrade this one feature, not take down
// the whole Settings screen (which is eagerly loaded at launch).
let DocumentPicker: typeof import('expo-document-picker') | null = null;
try {
  DocumentPicker = require('expo-document-picker');
} catch (e) {
  console.warn('[Settings] expo-document-picker unavailable:', e);
}

const GRID_OPTIONS = [{ l: '3×6', r: 3, c: 6 }, { l: '2×9', r: 2, c: 9 }];
const MAPPING_OPTIONS: { label: string; value: MappingMethod }[] = [
 { label: 'Cylindrical', value: 'cylindrical' },
 { label: 'Conformal', value: 'conformal' },
 { label: 'Geodesic', value: 'geodesic' },
];

const KALMAN_FIELDS = [
 { label: 'Q True', key: 'qTrue' as const, min: 0.01, max: 1.0, step: 0.01, color: color.cyan },
 { label: 'Q Drift Active', key: 'qDriftActive' as const, min: 0.01, max: 0.5, step: 0.01, color: color.amber },
 { label: 'R Measurement', key: 'rMeas' as const, min: 0.1, max: 2.0, step: 0.1, color: color.cyan },
 { label: 'Drift Threshold', key: 'driftThreshold' as const, min: 0.5, max: 5.0, step: 0.25, color: color.green },
];

export default function SettingsScreen() {
 const router = useRouter();
 const { activeProfile, profiles, setActiveProfile, createProfile, updateActiveProfile } = useProfile();
 const { session, configured, signOut } = useAuth();
 const device = useDevice();
 const [todayStats, setTodayStats] = useState({ count: 0, totalHours: 0 });
 const [showProfiles, setShowProfiles] = useState(false);
 const [newName, setNewName] = useState('');
 const [showTouchId, setShowTouchId] = useState(false);
 const [importing, setImporting] = useState(false);

 useEffect(() => { loadTodayStats(); }, []);

 const loadTodayStats = async () => {
 const stats = await getTodaySessionStats();
 setTodayStats(stats);
 };

 const grid = activeProfile?.grid ?? { rows: 3, cols: 6 };
 const mappingMethod: MappingMethod = (activeProfile?.mapping?.method as MappingMethod) ?? 'cylindrical';

 const handleBleToggle = () => {
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 device.toggleBle();
 };

 const handleCreateProfile = async () => {
 if (!newName.trim()) return;
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 await createProfile(newName.trim());
 setNewName('');
 setShowProfiles(false);
 };

 const saveGrid = (r: number, c: number) => {
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 updateActiveProfile({ grid: { rows: r, cols: c } });
 };

 const saveMapping = (method: MappingMethod) => {
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 const prevMapping = activeProfile?.mapping ?? { method: 'cylindrical', coverage: 0.85, offset: 2.0 };
 updateActiveProfile({ mapping: { ...prevMapping, method } });
 };

 const handleZero = () => {
 device.zeroCalibrate();
 Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
 Alert.alert('Zeroed', 'Current sensor readings captured as the new baseline for this profile.');
 };

 const handleClearZero = () => {
 device.clearZeroCalibration();
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 };

 const handleChooseSocket = async () => {
 if (!activeProfile) return;
 if (!DocumentPicker) {
 Alert.alert('Unavailable', 'File import isn\'t available on this build.');
 return;
 }
 const result = await DocumentPicker.getDocumentAsync({
 type: ['model/stl', 'model/obj', '*/*'],
 copyToCacheDirectory: true,
 });
 if (result.canceled || !result.assets?.[0]) return;
 const asset = result.assets[0];
 const ext = (asset.name.split('.').pop() || '').toLowerCase();
 if (ext !== 'stl' && ext !== 'obj') {
 Alert.alert('Unsupported file', 'Choose an .stl or .obj socket model.');
 return;
 }
 setImporting(true);
 try {
 const fields = await importSocketFile(activeProfile.id, asset.uri, asset.name);
 await updateActiveProfile(fields);
 Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
 } catch (e) {
 Alert.alert('Import failed', String(e));
 } finally {
 setImporting(false);
 }
 };

 const handleClearSocket = async () => {
 if (!activeProfile) return;
 await clearSocketFile(activeProfile);
 await updateActiveProfile({ socket_uri: undefined, socket_name: undefined });
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 };

 return (
 <ScreenScaffold
 title="Settings"
 rightAction={
 <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={{ padding: 4 }}>
 <Text style={{ color: color.cyan, fontFamily: font.mono, fontSize: 11, letterSpacing: 1 }}>DONE</Text>
 </TouchableOpacity>
 }
 >
 <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
 {/* Profile */}
 <Section>
 <Lbl>Profile</Lbl>
 <View style={styles.profileRow}>
 <View style={styles.profileInfo}>
 <Text style={styles.profileName}>{activeProfile?.name ?? 'No Profile'}</Text>
 <Text style={styles.profileId}>{activeProfile?.patient_id ?? ''}</Text>
 </View>
 <Btn tone="ghost" onPress={() => setShowProfiles(!showProfiles)}>
 {showProfiles ? 'Close' : 'Switch'}
 </Btn>
 </View>
 {showProfiles && (
 <View style={styles.profileList}>
 {profiles.map(p => (
 <TouchableOpacity
 key={p.id}
 style={[styles.profileItem, p.id === activeProfile?.id && { borderColor: color.cyan, backgroundColor: color.cyan + '08' }]}
 onPress={() => { setActiveProfile(p.id); setShowProfiles(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
 >
 <Text style={[styles.profileItemName, p.id === activeProfile?.id && { color: color.cyan }]}>{p.name}</Text>
 <Text style={styles.profileItemId}>{p.patient_id}</Text>
 </TouchableOpacity>
 ))}
 <View style={styles.newProfileRow}>
 <TouchableOpacity
 style={[styles.newProfileBtn, { borderColor: color.cyan + '40' }]}
 onPress={handleCreateProfile}
 >
 <Text style={{ color: color.cyan, fontFamily: font.mono, fontSize: 18 }}>+</Text>
 </TouchableOpacity>
 <View style={{ flex: 1, marginLeft: space.sm }}>
 <Text style={styles.newProfileLabel}>New Profile</Text>
 <TouchableOpacity onPress={handleCreateProfile}><Text style={[styles.newProfileBtnText, { color: color.cyan }]}>Create new</Text></TouchableOpacity>
 </View>
 </View>
 </View>
 )}
 </Section>

 {/* Account */}
 <Section>
 <Lbl>Account</Lbl>
 {!configured ? (
 <Text style={styles.hint}>Not configured — missing Supabase env vars.</Text>
 ) : session ? (
 <>
 <Text style={styles.toggleLabel}>{session.user.email}</Text>
 <Text style={styles.hint}>Profiles and sessions sync to the cloud automatically.</Text>
 <View style={{ height: space.sm }} />
 <Btn tone="outline" onPress={() => signOut()}>Sign Out</Btn>
 </>
 ) : (
 <Text style={styles.hint}>Not signed in.</Text>
 )}
 </Section>

 {/* Data Source */}
 <Section>
 <Lbl>Data Source</Lbl>
 <View style={styles.toggleRow}>
 <Text style={styles.toggleLabel}>{device.useBle ? 'BLE Device' : 'Simulated'}</Text>
 <Btn tone={device.useBle ? 'amber' : 'cyan'} onPress={handleBleToggle}>
 {device.useBle ? 'Disconnect' : 'Connect'}
 </Btn>
 </View>
 {device.useBle && (
 <View style={styles.statusRow}>
 <View style={[styles.statusDot, {
 backgroundColor: device.bleStatus === 'connected' ? color.green
 : device.bleStatus === 'scanning' ? color.amber : color.red,
 }]} />
 <Text style={styles.statusText}>
 {device.bleStatus === 'connected' ? `Connected — ${DEVICE_NAMES[0]}`
 : device.bleStatus === 'scanning' ? 'Scanning for device…'
 : 'No device found — using simulated data'}
 </Text>
 </View>
 )}
 <Text style={styles.hint}>Scanning for: {DEVICE_NAMES.join(', ')}</Text>
 </Section>

 {/* Session Stats */}
 <Section>
 <Lbl>Today's Activity</Lbl>
 <Row style={styles.statsRow}>
 <StatTile label="Sessions" value={todayStats.count} />
 <StatTile label="Wear Time" value={todayStats.totalHours.toFixed(1)} unit="h" />
 </Row>
 </Section>

 {/* Sensor Grid */}
 <Section>
 <Lbl>Sensor Grid</Lbl>
 <Text style={styles.hint}>Applies to {activeProfile?.name ?? 'this profile'}. The 18 sensors are fixed by the hardware — this only changes the on-screen layout and how they're distributed on the 3D socket.</Text>
 <View style={styles.optionRow}>
 <Text style={styles.optionLabel}>Layout</Text>
 <View style={styles.btnRow}>
 {GRID_OPTIONS.map(opt => (
 <TouchableOpacity key={opt.l} onPress={() => saveGrid(opt.r, opt.c)}>
 <View style={[styles.optChip, grid.rows === opt.r && grid.cols === opt.c && { borderColor: color.cyan, backgroundColor: color.cyan + '15' }]}>
 <Text style={[styles.optText, grid.rows === opt.r && grid.cols === opt.c && { color: color.cyan }]}>{opt.l}</Text>
 </View>
 </TouchableOpacity>
 ))}
 </View>
 </View>
 <View style={styles.optionRow}>
 <Text style={styles.optionLabel}>Mapping</Text>
 <View style={styles.btnRow}>
 {MAPPING_OPTIONS.map(m => (
 <TouchableOpacity key={m.value} onPress={() => saveMapping(m.value)}>
 <View style={[styles.optChip, mappingMethod === m.value && { borderColor: color.cyan, backgroundColor: color.cyan + '15' }]}>
 <Text style={[styles.optText, mappingMethod === m.value && { color: color.cyan }]}>{m.label}</Text>
 </View>
 </TouchableOpacity>
 ))}
 </View>
 </View>
 </Section>

 {/* Socket Model */}
 <Section>
 <Lbl>Socket Model</Lbl>
 <Text style={styles.hint}>{activeProfile?.socket_name ?? '(default socket)'}</Text>
 <View style={{ height: space.sm }} />
 <Row style={{ gap: space.sm }}>
 <Btn tone="cyan" onPress={handleChooseSocket} style={{ flex: 1 }}>
 {importing ? 'Importing…' : 'Choose STL / OBJ…'}
 </Btn>
 {activeProfile?.socket_uri && (
 <Btn tone="ghost" onPress={handleClearSocket}>Clear</Btn>
 )}
 </Row>
 </Section>

 {/* Kalman Tuning */}
 <Section>
 <Lbl>Kalman Filter Tuning</Lbl>
 {KALMAN_FIELDS.map(f => (
 <KalmanStepper
 key={f.key}
 label={f.label}
 value={device.kalman[f.key]}
 min={f.min}
 max={f.max}
 step={f.step}
 color={f.color}
 onChange={(v) => device.setKalman({ [f.key]: v })}
 />
 ))}
 <Btn tone="outline" onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); device.resetKalman(); }}>
 Reset to Defaults
 </Btn>
 </Section>

 {/* Calibration */}
 <Section>
 <Lbl>Calibration</Lbl>
 <Text style={styles.hint}>
 {device.hasZeroCalibration ? 'Zeroed for this profile.' : 'Not zeroed.'}
 </Text>
 <View style={{ height: space.sm }} />
 <Row style={{ gap: space.sm }}>
 <Btn tone="cyan" onPress={handleZero} style={{ flex: 1 }}>
 Zero / Tare
 </Btn>
 {device.hasZeroCalibration && (
 <Btn tone="ghost" onPress={handleClearZero}>Clear</Btn>
 )}
 </Row>
 <View style={{ height: space.sm }} />
 <Btn tone="outline" onPress={async () => { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowTouchId(true); }}>
 Touch-to-Identify
 </Btn>
 </Section>

 {/* About */}
 <Section>
 <Lbl>About</Lbl>
 <View style={styles.aboutGrid}>
 <AboutItem label="App" value="1.0.0" />
 <AboutItem label="Device" value="AVA Fit" />
 <AboutItem label="Sensors" value="18 channels" />
 <AboutItem label="Protocol" value="BLE GATT" />
 </View>
 <Text style={styles.disclaimer}>
 AVA Fit is a clinical research tool. Not a substitute for professional medical assessment. Always consult your prosthetist.
 </Text>
 </Section>
 </ScrollView>

 <TouchToIdentifyModal visible={showTouchId} onClose={() => setShowTouchId(false)} rows={grid.rows} cols={grid.cols} />
 </ScreenScaffold>
 );
}

function Section({ children }: { children: React.ReactNode }) {
 return <Panel style={styles.section}>{children}</Panel>;
}

function AboutItem({ label, value }: { label: string; value: string }) {
 return (
 <View style={styles.aboutItem}>
 <Text style={styles.aboutLabel}>{label}</Text>
 <Text style={styles.aboutValue}>{value}</Text>
 </View>
 );
}

/** A real, working slider substitute: tap −/+ to step the value, no native
 * gesture dependency needed. The fill bar now reflects an editable value
 * instead of just decorating a number nothing could change. */
function KalmanStepper({ label, value, min, max, step, color: tint, onChange }: {
 label: string; value: number; min: number; max: number; step: number; color: string;
 onChange: (v: number) => void;
}) {
 const clamp = (v: number) => Math.max(min, Math.min(max, +v.toFixed(4)));
 const bump = (dir: 1 | -1) => {
 Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
 onChange(clamp(value + dir * step));
 };
 return (
 <View style={styles.sliderRow}>
 <Text style={styles.sliderLabel}>{label}</Text>
 <TouchableOpacity onPress={() => bump(-1)} style={styles.stepBtn}>
 <Text style={styles.stepBtnText}>−</Text>
 </TouchableOpacity>
 <View style={styles.sliderTrack}>
 <View style={[styles.sliderFill, { width: `${Math.min(100, Math.max(0, (value - min) / (max - min) * 100))}%`, backgroundColor: tint }]} />
 </View>
 <TouchableOpacity onPress={() => bump(1)} style={styles.stepBtn}>
 <Text style={styles.stepBtnText}>+</Text>
 </TouchableOpacity>
 <Text style={styles.sliderVal}>{value.toFixed(2)}</Text>
 </View>
 );
}

/** Live verification tool: shows the real-time sensor grid so a clinician can
 * press each physical pad and confirm the matching cell lights up on screen.
 * Uses the same live reading everywhere else in the app — not simulated. */
function TouchToIdentifyModal({ visible, onClose, rows, cols }: { visible: boolean; onClose: () => void; rows: number; cols: number }) {
 const reading = useFitReading();
 return (
 <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
 <View style={styles.modalBackdrop}>
 <View style={styles.modalCard}>
 <Text style={styles.modalTitle}>Touch-to-Identify</Text>
 <Text style={styles.modalHint}>
 Press each sensor pad on the physical socket one at a time. The cell that lights up brightest below should match the pad you're pressing — the highlighted cell is the current peak.
 </Text>
 <View style={{ marginTop: space.md }}>
 <PressureGrid frame={reading.frame} maxKpa={100} hotIndex={reading.hotIndex} rows={rows} cols={cols} />
 </View>
 <Btn tone="cyan" onPress={onClose} style={{ marginTop: space.lg }}>Done</Btn>
 </View>
 </View>
 </Modal>
 );
}

const styles = StyleSheet.create({
 scroll: { paddingBottom: space.xxl },
 section: { padding: space.md, marginBottom: space.md },
 profileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
 profileInfo: { flex: 1 },
 profileName: { fontFamily: font.bodySemi, fontSize: 15, color: color.text },
 profileId: { fontFamily: font.mono, fontSize: 11, color: color.textFaint, marginTop: 2 },
 profileList: { marginTop: space.md, gap: space.sm },
 profileItem: { padding: space.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: color.line, backgroundColor: color.panelDeep },
 profileItemName: { fontFamily: font.bodySemi, fontSize: 13, color: color.text },
 profileItemId: { fontFamily: font.mono, fontSize: 10, color: color.textFaint, marginTop: 2 },
 newProfileRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
 newProfileBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
 newProfileLabel: { fontFamily: font.mono, fontSize: 10, color: color.textFaint, letterSpacing: 0.5 },
 newProfileBtnText: { fontFamily: font.monoMed, fontSize: 12, marginTop: 2 },
 input: { fontFamily: font.mono, fontSize: 13, color: color.text, borderWidth: 1, borderColor: color.line, backgroundColor: color.panelDeep, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 10 },
 toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
 toggleLabel: { fontFamily: font.monoMed, fontSize: 14, color: color.text },
 statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm, gap: 8 },
 statusDot: { width: 8, height: 8, borderRadius: 4 },
 statusText: { fontFamily: font.mono, fontSize: 11, color: color.textDim },
 hint: { fontFamily: font.mono, fontSize: 10, color: color.textFaint, marginTop: 4, lineHeight: 15 },
 statsRow: { marginTop: space.sm, gap: space.sm },
 optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
 optionLabel: { fontFamily: font.mono, fontSize: 12, color: color.text },
 btnRow: { flexDirection: 'row', gap: 4 },
 optChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: color.line, backgroundColor: color.panelDeep },
 optText: { fontFamily: font.mono, fontSize: 11, color: color.textDim },
 sliderRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm, gap: space.sm },
 sliderLabel: { fontFamily: font.mono, fontSize: 11, color: color.textDim, width: 88 },
 stepBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: color.line, alignItems: 'center', justifyContent: 'center' },
 stepBtnText: { fontFamily: font.monoMed, fontSize: 14, color: color.textDim, marginTop: -1 },
 sliderTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: color.line, overflow: 'hidden' },
 sliderFill: { height: '100%', borderRadius: 3 },
 sliderVal: { fontFamily: font.mono, fontSize: 11, color: color.text, width: 46, textAlign: 'right' },
 aboutGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm, gap: space.sm },
 aboutItem: { width: '48%', backgroundColor: color.panelDeep, borderRadius: 8, padding: space.sm, borderWidth: 1, borderColor: color.line },
 aboutLabel: { fontFamily: font.mono, fontSize: 9, color: color.textFaint, letterSpacing: 0.5, marginBottom: 2 },
 aboutValue: { fontFamily: font.monoMed, fontSize: 14, color: color.cyan },
 disclaimer: { fontFamily: font.mono, fontSize: 10, color: color.textFaint, lineHeight: 16, marginTop: space.md },
 modalBackdrop: { flex: 1, backgroundColor: 'rgba(4,8,16,0.7)', justifyContent: 'flex-end' },
 modalCard: { backgroundColor: color.panel, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: color.line, padding: space.lg, paddingBottom: space.xl },
 modalTitle: { fontFamily: font.bodyBold, fontSize: 18, color: color.text, marginBottom: space.sm },
 modalHint: { fontFamily: font.body, fontSize: 12, color: color.textDim, lineHeight: 18 },
});
