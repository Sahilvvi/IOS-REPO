import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Panel, Btn, Dot } from './ui';
import { DEVICE_NAMES, useDevice } from '@/pressure/PressureProvider';
import { color, font, space } from '@/theme/tokens';

/** Home-screen "Connect Device" affordance — mirrors the desktop app's
 * hero-row Connect Device button. Basic, single-tap connection: no
 * scan-and-pick list (matches the firmware/desktop pattern of auto-connect
 * by known device name), transparently falls back to simulated data on
 * failure so the rest of the app always has something to show. */
export function ConnectDeviceCard() {
  const device = useDevice();

  const label = !device.useBle
    ? 'Not connected'
    : device.bleStatus === 'connected'
      ? `Connected — ${DEVICE_NAMES[0]}`
      : device.bleStatus === 'scanning'
        ? 'Scanning…'
        : 'No device found — using simulated data';

  const dotColor = !device.useBle
    ? color.textFaint
    : device.bleStatus === 'connected'
      ? color.green
      : device.bleStatus === 'scanning'
        ? color.amber
        : color.red;

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    device.toggleBle();
  };

  return (
    <Panel style={styles.card}>
      <View style={styles.row}>
        <View style={styles.statusCol}>
          <View style={styles.statusRow}>
            <Dot color={dotColor} />
            <Text style={styles.label}>{label}</Text>
          </View>
          {!device.useBle && (
            <Text style={styles.hint}>Scanning for: {DEVICE_NAMES.join(', ')}</Text>
          )}
        </View>
        <Btn tone={device.useBle ? 'amber' : 'cyan'} onPress={toggle}>
          {device.useBle ? 'Disconnect' : 'Connect Device'}
        </Btn>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md, marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  statusCol: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: font.monoMed, fontSize: 13, color: color.text },
  hint: { fontFamily: font.mono, fontSize: 10, color: color.textFaint, marginTop: 4, lineHeight: 14 },
});
