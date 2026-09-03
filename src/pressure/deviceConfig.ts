/**
 * Everything about the physical socket board, in one place.
 *
 * Values taken from the firmware (adapt/firmware/firmware_unified.ino) and the
 * desktop app's defaults (adapt/desktop/settings_store.py). If you reflash
 * with different identifiers, this is the only file that needs to change —
 * previously these lived inline inside BlePressureSource.ts, duplicated
 * (and liable to drift) from the sibling ava-fit-complete project's copy.
 */

/** The full names the app scans for, in priority order. */
export const DEVICE_NAMES = [
  'PROJECT-X-MCU',
  'PROJECT-X-MCU-LEGACY',
  'PROJECT-X-18Node',
];

export const SERVICE_UUID = 'abcd0001-1111-2222-3333-abcdefabcdef';

/** Combined pressure + IMU + activity frames arrive here, as NOTIFY. */
export const PRESSURE_CHAR_UUID = 'abcd0002-1111-2222-3333-abcdefabcdef';

/** Older firmware split the IMU onto its own characteristic. */
export const IMU_CHAR_UUID = 'abcd0003-1111-2222-3333-abcdefabcdef';

/**
 * The Python bridge — adapt/backend/App.py, uvicorn on 0.0.0.0:8080.
 *
 * Use localhost when running in a simulator on the same machine as the
 * bridge. From a physical phone on the same network, this needs to be the
 * bridge machine's LAN address instead — there is no way to discover that
 * automatically, so it stays a plain constant here rather than pretending to
 * be zero-config.
 */
export const BRIDGE_URL = 'http://localhost:8080';

/** How often to poll the bridge. The firmware pushes at roughly this rate. */
export const BRIDGE_POLL_MS = 200;
