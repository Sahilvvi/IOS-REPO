import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Panel, Dot } from './ui';
import { DEVICE_NAMES, useDevice } from '@/pressure/PressureProvider';
import { color, font, space, radius } from '@/theme/tokens';

type SourceKind = 'simulated' | 'ble' | 'bridge';

/** Home-screen "Connect Device" affordance — a 3-way picker (Simulator /
 * Bluetooth / Bridge) instead of a single BLE-only toggle, so a device that
 * genuinely isn't being found has both a diagnostic message and a working
 * fallback path (the Python bridge) rather than a dead end. Mirrors the
 * pattern proven in the ava-fit-complete reference build's ConnectionCard,
 * adapted onto this app's own Panel/Btn/Dot primitives. */
export function ConnectDeviceCard() {
  const device = useDevice();

  const kind: SourceKind = device.useBridge ? 'bridge' : device.useBle ? 'ble' : 'simulated';

  const select = (next: SourceKind) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (next === 'simulated') {
      if (device.useBle) device.toggleBle();
      if (device.useBridge) device.disconnectBridge();
    } else if (next === 'ble') {
      if (!device.useBle) device.toggleBle();
    } else {
      device.connectBridge();
    }
  };

  const dotColor =
    kind === 'simulated'
      ? color.textFaint
      : kind === 'ble'
        ? device.bleStatus === 'connected' ? color.green : device.bleStatus === 'scanning' ? color.amber : color.red
        : device.bridgeStatus?.connected ? color.green : device.bridgeStatus?.reachable ? color.amber : color.red;

  const detail =
    kind === 'simulated'
      ? 'Using synthetic gait data.'
      : kind === 'ble'
        ? device.bleStatus === 'connected'
          ? `Connected — ${DEVICE_NAMES[0]}`
          : device.bleStatus === 'scanning'
            ? `Scanning for ${DEVICE_NAMES.join(', ')}…`
            : device.bleError ?? 'No device found — using simulated data.'
        : device.bridgeStatus?.connected
          ? `Bridge connected — ${device.bridgeStatus.source}${device.bridgeStatus.device ? ` (${device.bridgeStatus.device})` : ''}`
          : device.bridgeStatus?.reachable
            ? 'Bridge reachable but not connected to the socket — using its emulator.'
            : device.bridgeStatus?.error ?? 'Connecting to bridge…';

  return (
    <Panel style={styles.card}>
      <View style={styles.statusRow}>
        <Dot color={dotColor} />
        <Text style={styles.detail} numberOfLines={2}>{detail}</Text>
      </View>
      {kind === 'ble' && device.bleDevices.length > 1 && (
        <Text style={styles.hint}>{device.bleDevices.length} matching devices nearby — connected to the first found.</Text>
      )}
      <View style={styles.optionRow}>
        <Option label="Simulator" active={kind === 'simulated'} onPress={() => select('simulated')} />
        <Option label="Bluetooth" active={kind === 'ble'} onPress={() => select('ble')} />
        <Option label="Bridge" active={kind === 'bridge'} onPress={() => select('bridge')} />
      </View>
    </Panel>
  );
}

function Option({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.option, active && styles.optionActive]}>
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, marginBottom: space.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detail: { flex: 1, fontFamily: font.monoMed, fontSize: 12, color: color.text, lineHeight: 16 },
  hint: { fontFamily: font.mono, fontSize: 10, color: color.textFaint, marginTop: 6, lineHeight: 14 },
  optionRow: { flexDirection: 'row', gap: space.xs, marginTop: space.sm },
  option: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.sm,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: color.line,
  },
  optionActive: { backgroundColor: color.cyan + '18', borderColor: color.cyan },
  optionText: { fontFamily: font.mono, fontSize: 10, letterSpacing: 0.8, color: color.textFaint },
  optionTextActive: { color: color.cyan },
});
