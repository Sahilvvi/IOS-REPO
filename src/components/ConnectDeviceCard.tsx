import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Panel, Dot } from './ui';
import { useDevice } from '@/pressure/PressureProvider';
import { color, font, space, radius } from '@/theme/tokens';

/**
 * Home-screen "Connect Device" affordance.
 *
 * Was a 3-way Simulator/Bluetooth/Bridge segmented control that put internal
 * test-board names ("Scanning for Joe_AVA_fit, Rustin_AVA_fit, Demo_AVA_fit…")
 * and dev jargon (Bridge = a Python tool no patient should ever need) right
 * in front of a patient. Reduced to the one thing a patient actually wants —
 * a single "Connect Your AVA Fit" button — with Simulator/Bridge still fully
 * working underneath, just tucked behind a collapsed "Advanced" section for
 * whoever's demoing or debugging.
 */
export function ConnectDeviceCard() {
  const device = useDevice();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const connected = device.useBle && device.bleStatus === 'connected';
  const connecting = device.useBle && device.bleStatus === 'scanning';
  const failed = device.useBle && device.bleStatus === 'fallback';
  const onBridge = device.useBridge;
  const onSimulator = !device.useBle && !device.useBridge;

  const label = connected
    ? 'AVA Fit Connected'
    : connecting
      ? 'Connecting…'
      : failed
        ? 'Tap to Try Again'
        : 'Connect Your AVA Fit';

  const dotColor = connected ? color.green : connecting ? color.amber : failed ? color.red : color.textFaint;

  const detail = connected
    ? 'Live pressure data is streaming from your socket.'
    : connecting
      ? 'Looking for your AVA Fit socket nearby…'
      : failed
        ? 'Couldn’t find your AVA Fit. Make sure it’s powered on and close by, then try again.'
        : onBridge
          ? 'Connected via bridge — using its test data.'
          : 'Not connected yet — showing sample data for now.';

  const onPressMain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onBridge) device.disconnectBridge();
    if (device.useBle) {
      if (failed) device.retryBle();
      // else already connecting/connected — nothing to do
    } else {
      device.toggleBle();
    }
  };

  return (
    <Panel style={styles.card}>
      <Pressable
        onPress={onPressMain}
        disabled={connecting}
        style={({ pressed }) => [styles.mainButton, connected && styles.mainButtonConnected, pressed && styles.mainButtonPressed]}
      >
        {connecting ? (
          <ActivityIndicator size="small" color={color.cyan} style={{ marginRight: 10 }} />
        ) : (
          <Dot color={dotColor} />
        )}
        <Text style={[styles.mainLabel, connected && styles.mainLabelConnected]}>{label}</Text>
      </Pressable>

      <Text style={styles.detail} numberOfLines={2}>{detail}</Text>

      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAdvancedOpen((v) => !v); }}
        style={styles.advancedToggle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.advancedToggleText}>{advancedOpen ? 'HIDE ADVANCED' : 'ADVANCED'}</Text>
      </Pressable>

      {advancedOpen && (
        <View style={styles.advancedPanel}>
          <Option
            label="Simulator"
            active={onSimulator}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (device.useBle) device.toggleBle();
              if (device.useBridge) device.disconnectBridge();
            }}
          />
          <Option
            label="Bridge"
            active={onBridge}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); device.connectBridge(); }}
          />
          {device.bleDevices.length > 1 && device.useBle && (
            <Text style={styles.hint}>{device.bleDevices.length} matching devices nearby — connected to the first found.</Text>
          )}
        </View>
      )}
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
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.panelDeep,
    gap: 10,
  },
  mainButtonConnected: { backgroundColor: color.green + '18', borderColor: color.green },
  mainButtonPressed: { opacity: 0.85 },
  mainLabel: { fontFamily: font.monoMed, fontSize: 13, letterSpacing: 0.5, color: color.text },
  mainLabelConnected: { color: color.green },
  detail: { fontFamily: font.mono, fontSize: 11, color: color.textFaint, marginTop: space.sm, lineHeight: 16, textAlign: 'center' },
  advancedToggle: { alignSelf: 'center', marginTop: space.sm, paddingVertical: 4 },
  advancedToggleText: { fontFamily: font.mono, fontSize: 9, letterSpacing: 1, color: color.textFaint },
  advancedPanel: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: color.line, flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  hint: { fontFamily: font.mono, fontSize: 10, color: color.textFaint, marginTop: 6, lineHeight: 14, width: '100%' },
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
