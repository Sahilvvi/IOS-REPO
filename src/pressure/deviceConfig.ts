/**
 * Everything about the physical socket boards, in one place.
 *
 * Three units are in service, one per patient. Identifiers here must match the
 * DEVICE_NAME / DEVICE_ID block at the top of firmware_unified.ino exactly.
 */

/** Must match the DEVICE_NAME / DEVICE_ID pairs in the firmware. */
export interface DeviceProfile {
  /** BLE advertised name. Exact, case-sensitive. */
  readonly bleName: string;
  /** Short id the firmware stamps into the D: section of every frame. */
  readonly deviceId: string;
  /** What the clinician sees. */
  readonly label: string;
}

export const DEVICES: readonly DeviceProfile[] = [
  { bleName: 'Joe_AVA_fit', deviceId: 'JOE', label: 'Joe' },
  { bleName: 'Rustin_AVA_fit', deviceId: 'RUS', label: 'Rustin' },
  { bleName: 'Demo_AVA_fit', deviceId: 'DEM', label: 'Demo unit' },
];

/** Names to match while scanning. Nothing else should ever be connected to. */
export const DEVICE_NAMES = DEVICES.map((d) => d.bleName);

/**
 * Boards that have not been reflashed yet.
 *
 * Deliberately NOT in DEVICE_NAMES. These names are ambiguous across the three
 * units, so a connection to one cannot be attributed to a patient. Add a name
 * here only while migrating, and remove it once every board is reflashed.
 */
export const LEGACY_DEVICE_NAMES = [
  'PROJECT-X-MCU',
  'PROJECT-X-MCU-LEGACY',
  'PROJECT-X-18Node',
  'Quorum-AVA-FIT',
];

export function deviceByBleName(name: string): DeviceProfile | undefined {
  return DEVICES.find((d) => d.bleName === name);
}

export function deviceById(id: string): DeviceProfile | undefined {
  return DEVICES.find((d) => d.deviceId === id);
}

export const SERVICE_UUID = 'abcd0001-1111-2222-3333-abcdefabcdef';

/** Combined pressure + IMU + activity frames arrive here, as NOTIFY. */
export const PRESSURE_CHAR_UUID = 'abcd0002-1111-2222-3333-abcdefabcdef';

/** Older firmware split the IMU onto its own characteristic. */
export const IMU_CHAR_UUID = 'abcd0003-1111-2222-3333-abcdefabcdef';

/**
 * The Python bridge - adapt/backend/App.py, uvicorn on 0.0.0.0:8080.
 *
 * Use localhost when running in a simulator on the same machine as the bridge.
 * From a physical phone on the same network this needs to be the bridge
 * machine's LAN address instead - there is no way to discover that
 * automatically, so it stays a plain constant rather than pretending to be
 * zero-config.
 */
export const BRIDGE_URL = 'http://localhost:8080';

/** How often to poll the bridge. The firmware pushes at roughly this rate. */
export const BRIDGE_POLL_MS = 200;

// ---------------------------------------------------------------------------
// Frame identity
// ---------------------------------------------------------------------------

/**
 * A BLE name identifies a board at CONNECT time. It is not carried in the data.
 *
 * With three units powered on one bench, a dropped link that reconnects to
 * whichever board is nearest attributes one patient's readings to another, and
 * nothing in the stream says so - the fit score stays plausible and the log
 * keeps filling with the wrong limb's data. Once mixed, a session cannot be
 * separated after the fact.
 *
 * So the firmware stamps every frame:  D:JOE|P:...|I:...|A:...
 * and this is checked on every frame, before the numbers are parsed.
 */

export interface SplitFrame {
  /** Device id from the D: section, or null on pre-D: firmware. */
  deviceId: string | null;
  /** Everything after the D: section, for parseCombinedFrame to handle. */
  body: string;
}

export function splitDeviceId(raw: string): SplitFrame {
  const text = String(raw ?? '').trim();
  if (!text.startsWith('D:')) return { deviceId: null, body: text };

  const bar = text.indexOf('|');
  if (bar < 0) return { deviceId: text.slice(2).trim() || null, body: '' };

  return {
    deviceId: text.slice(2, bar).trim() || null,
    body: text.slice(bar + 1),
  };
}

export type GuardResult =
  | { ok: true; body: string; warning?: string }
  | { ok: false; reason: string };

/**
 * Check a frame belongs to the device we think we are connected to.
 *
 * Cheap - a string compare - and it is the only thing standing between a
 * reconnect to the wrong board and one patient's data landing in another's
 * record. `expected` null means no board has been chosen, which is itself a
 * reason to reject rather than display data under an unknown identity.
 */
export function guardFrame(
  raw: string,
  expected: DeviceProfile | null,
): GuardResult {
  const { deviceId, body } = splitDeviceId(raw);

  if (!expected) return { ok: false, reason: 'No device selected' };

  // An empty payload is a dropped or truncated notification, not a frame from
  // older firmware. Treating it as the latter would let a silent link failure
  // masquerade as a working legacy board.
  if (!body && deviceId === null) {
    return { ok: false, reason: 'Empty frame received' };
  }

  if (deviceId === null) {
    // Pre-D: firmware. Allowed, because a half-migrated bench is real, but say
    // plainly that identity cannot be verified on this build.
    return {
      ok: true,
      body,
      warning:
        `${expected.label}: board is on older firmware with no device id. ` +
        `Identity cannot be verified - reflash before recording patient data.`,
    };
  }

  if (deviceId !== expected.deviceId) {
    const actual = deviceById(deviceId);
    return {
      ok: false,
      reason: actual
        ? `Wrong device: expected ${expected.label}, receiving ${actual.label}`
        : `Wrong device: expected ${expected.label}, receiving unknown id "${deviceId}"`,
    };
  }

  return { ok: true, body };
}
