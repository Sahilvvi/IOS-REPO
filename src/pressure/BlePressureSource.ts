/**
 * Real BLE pressure source for iOS.
 *
 * Connects to the ESP32-S3 prosthetic socket MCU via BLE.
 * Scans for the device by name, subscribes to the pressure characteristic,
 * and parses the ASCII frame format:
 * P:kpa0,...,kpa17|I:ax,ay,az,gx,gy,gz,temp|A:activity
 *
 * Falls back to a simulation source on any BLE failure.
 */
import { Platform, PermissionsAndroid } from 'react-native';
import { PressureFrame, PressureSource, SENSOR_COUNT } from './types';
import { SERVICE_UUID, PRESSURE_CHAR_UUID, DEVICE_NAMES } from './deviceConfig';

export { SERVICE_UUID, PRESSURE_CHAR_UUID, DEVICE_NAMES } from './deviceConfig';

/**
 * Parse the ASCII frame format from the ESP32 firmware:
 * P:12.34,56.78,...|I:0.1,0.2,...|A:WALKING
 */
function parseCombinedFrame(raw: string): { pressure: number[]; imu?: number[]; activity?: string } | null {
  if (!raw.includes('P:') && !raw.includes('I:') && !raw.includes('A:')) return null;

  const result: { pressure: number[]; imu?: number[]; activity?: string } = { pressure: [] };

  for (const rawChunk of raw.split('|')) {
    const chunk = rawChunk.trim();
    if (chunk.startsWith('P:')) {
      const vals = chunk.slice(2).split(',').map(Number).filter(v => !isNaN(v));
      // A short list means the BLE notification arrived truncated (see the MTU
      // note in BLE-CONNECTION.md) — reject it rather than rendering a corrupt
      // half-frame padded with zeros.
      if (vals.length >= SENSOR_COUNT) result.pressure = vals;
    } else if (chunk.startsWith('I:')) {
      const parts = chunk.slice(2).split(',').map(Number).filter(v => !isNaN(v));
      if (parts.length >= 7) result.imu = parts.slice(0, 7);
    } else if (chunk.startsWith('A:')) {
      result.activity = chunk.slice(2).trim() || 'UNKNOWN';
    }
  }

  return result.pressure.length > 0 ? result : null;
}

export type BleStatus = 'scanning' | 'connected' | 'fallback';

/** A device seen during a scan that matched one of DEVICE_NAMES. */
export interface DiscoveredDevice {
  id: string;
  name: string;
}

export class BlePressureSource implements PressureSource {
  readonly id = 'ble';
  private manager: any = null;
  private device: any = null;
  private subId: string | null = null;
  private alive = true;
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private status: BleStatus = 'scanning';
  private statusListeners = new Set<(s: BleStatus) => void>();
  private error: string | null = null;
  private errorListeners = new Set<(msg: string | null) => void>();
  private discovered = new Map<string, DiscoveredDevice>();
  private deviceListListeners = new Set<(devices: DiscoveredDevice[]) => void>();

  constructor(private readonly fallback: PressureSource) {}

  onStatusChange(cb: (s: BleStatus) => void): () => void {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  /** A human-readable reason for the current 'fallback' status, or null when
   * not applicable — distinguishes "Bluetooth is off" from "no device found"
   * from "connected then dropped", which previously all collapsed into the
   * same undiagnostic 'fallback' state with no way to tell them apart. */
  onError(cb: (msg: string | null) => void): () => void {
    this.errorListeners.add(cb);
    cb(this.error);
    return () => this.errorListeners.delete(cb);
  }

  /** Every device matching DEVICE_NAMES seen so far during the current scan —
   * for visibility into what's actually nearby, even though the connect flow
   * below still auto-connects to the first match (unverified against real
   * hardware timing to change without a physical device to test against). */
  onDeviceList(cb: (devices: DiscoveredDevice[]) => void): () => void {
    this.deviceListListeners.add(cb);
    cb([...this.discovered.values()]);
    return () => this.deviceListListeners.delete(cb);
  }

  private setStatus(s: BleStatus) {
    this.status = s;
    for (const cb of this.statusListeners) cb(s);
  }

  private setError(msg: string | null) {
    this.error = msg;
    for (const cb of this.errorListeners) cb(msg);
  }

  private noteDiscovered(device: DiscoveredDevice) {
    if (this.discovered.has(device.id)) return;
    this.discovered.set(device.id, device);
    const list = [...this.discovered.values()];
    for (const cb of this.deviceListListeners) cb(list);
  }

  subscribe(onFrame: (frame: PressureFrame) => void): () => void {
    this.setStatus('scanning');
    this.setError(null);
    this.discovered.clear();
    this.connect(onFrame).catch(() => {
      if (this.alive) {
        this.setStatus('fallback');
        this.setError('Connection failed unexpectedly — using simulated data.');
        this.fallback.subscribe(onFrame);
      }
    });

    return () => {
      this.alive = false;
      this.teardown();
    };
  }

  /** Android treats BLE scan/connect as dangerous runtime permissions —
   * listing them in app.json's android.permissions only puts them in the
   * manifest, it does NOT grant them. Without this request, startDeviceScan
   * silently returns nothing (or a permission error the old code discarded),
   * which reads to the user as "Bluetooth never finds my device" forever.
   * iOS has no equivalent step here — its Bluetooth prompt is driven by
   * BleManager itself the first time it's used. */
  private async ensureAndroidPermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]);
        return (
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
          granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED
        );
      }
      // Below API 31, BLE scanning is gated behind location permission instead.
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  private async connect(onFrame: (frame: PressureFrame) => void): Promise<void> {
    try {
      const hasPermission = await this.ensureAndroidPermissions();
      if (!this.alive) return;
      if (!hasPermission) {
        this.setStatus('fallback');
        this.setError('Bluetooth permission was denied — enable it for AVA Fit in system settings, then reconnect.');
        this.fallback.subscribe(onFrame);
        return;
      }

      const btReady = await this.waitForBluetooth();
      if (!this.alive) return;
      if (!btReady) {
        this.setStatus('fallback');
        this.setError('Bluetooth is off, unsupported, or permission was denied — using simulated data.');
        this.fallback.subscribe(onFrame);
        return;
      }

      this.device = await this.findDevice();
      if (!this.device || !this.alive) {
        if (this.alive) {
          this.setStatus('fallback');
          this.setError(`No device matching "${DEVICE_NAMES.join('", "')}" found nearby — make sure it's powered on and in range, then reconnect.`);
          this.fallback.subscribe(onFrame);
        }
        return;
      }

      await this.device.connect();
      const services = await this.device.discoverAllServicesAndCharacteristics();

      let pressureChar: any = undefined;
      for (const svc of services) {
        if (svc.uuid.toLowerCase() === SERVICE_UUID.toLowerCase()) {
          const chars = await this.device.characteristicsForService(svc.uuid);
          pressureChar = chars.find((c: any) => c.uuid.toLowerCase() === PRESSURE_CHAR_UUID.toLowerCase());
          break;
        }
      }

      if (!pressureChar) {
        await this.device.cancelConnection();
        if (this.alive) {
          this.setStatus('fallback');
          this.setError('Device found but does not expose the expected pressure service — check firmware version.');
          this.fallback.subscribe(onFrame);
        }
        return;
      }

      try { await this.device.requestMTU(512); } catch {}

      this.subId = await this.device.monitorCharacteristicForService(
        SERVICE_UUID,
        PRESSURE_CHAR_UUID,
        (_err: any, characteristic: any) => {
          if (_err || !characteristic?.value || !this.alive) return;
          try {
            const base64 = characteristic.value;
            const text = this.base64ToString(base64);
            const parsed = parseCombinedFrame(text);
            if (parsed && parsed.pressure.length > 0) {
              const trimmed = parsed.pressure.slice(0, SENSOR_COUNT);
              while (trimmed.length < SENSOR_COUNT) trimmed.push(0);
              onFrame(trimmed);
            }
          } catch {
            // ignore corrupt frames
          }
        },
      );

      this.setStatus('connected');
      this.setError(null);

      this.device.onDisconnected(() => {
        if (this.alive) {
          this.setStatus('scanning');
          this.setError('Device disconnected — reconnecting…');
          this.connect(onFrame).catch(() => {
            if (this.alive) {
              this.setStatus('fallback');
              this.setError('Device disconnected and could not reconnect — using simulated data.');
              this.fallback.subscribe(onFrame);
            }
          });
        }
      });
    } catch (err) {
      if (this.alive) {
        this.setStatus('fallback');
        this.setError(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
        this.fallback.subscribe(onFrame);
      }
    }
  }

  private base64ToString(b64: string): string {
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      const clean = b64.replace(/=+$/, '');
      let binary = '';
      for (let i = 0; i < clean.length; i += 4) {
        const a = chars.indexOf(clean[i]);
        const b = chars.indexOf(clean[i + 1]);
        const c = chars.indexOf(clean[i + 2]);
        const d = chars.indexOf(clean[i + 3]);
        const triple = (a << 18) + (b << 12) + ((c || 0) << 6) + (d || 0);
        binary += String.fromCharCode((triple >> 16) & 255, (triple >> 8) & 255, triple & 255);
      }
      // The ESP32 sends UTF-8 ASCII text
      return decodeURIComponent(escape(binary));
    } catch {
      return b64;
    }
  }

  private async waitForBluetooth(): Promise<boolean> {
    return new Promise((resolve) => {
      const BleManager = require('react-native-ble-plx').BleManager;
      this.manager = new BleManager();

      const check = async () => {
        try {
          const state = await this.manager.state();
          if (state === 'PoweredOn') { resolve(true); return; }
          if (state === 'Unsupported' || state === 'PoweredOff') { resolve(false); return; }
        } catch { resolve(false); return; }
      };

      check();

      const timeout = setTimeout(() => {
        this.manager?.stopDeviceScan();
        resolve(false);
      }, 8000);

      this.manager.onStateChange((newState: string) => {
        if (newState === 'PoweredOn') { clearTimeout(timeout); resolve(true); }
        else if (newState === 'Unsupported' || newState === 'PoweredOff') { clearTimeout(timeout); resolve(false); }
      }, true);
    });
  }

  private async findDevice(): Promise<any> {
    const { BleManager } = require('react-native-ble-plx');
    const manager = this.manager || new BleManager();

    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await this.scan(manager);
      if (result.device) return result.device;
      // A scan-level error (permission denied, adapter dropped mid-scan) —
      // retrying two more 8s attempts won't change the outcome. Previously
      // this branch was unreachable because the callback below silently
      // discarded every scan error, so on a real permission failure the app
      // would just sit at "Scanning…" for the full 24s with no indication
      // anything had gone wrong.
      if (result.fatal) break;
    }
    return null;
  }

  private scan(manager: any): Promise<{ device: any | null; fatal?: boolean }> {
    return new Promise((resolve) => {
      let found: any = null;
      let settled = false;
      const finish = (result: { device: any | null; fatal?: boolean }) => {
        if (settled) return;
        settled = true;
        if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null; }
        manager.stopDeviceScan();
        resolve(result);
      };

      manager.startDeviceScan(null, null, (error: any, device: any) => {
        if (error) {
          this.setError(`Scan error: ${error.message ?? 'unknown'} — using simulated data.`);
          finish({ device: null, fatal: true });
          return;
        }
        if (!device) return;
        const name = (device.name ?? device.localName ?? '').toLowerCase();
        if (DEVICE_NAMES.some(dn => name.includes(dn.toLowerCase()))) {
          this.noteDiscovered({ id: device.id, name: device.name ?? device.localName ?? 'Unknown device' });
          if (!found) {
            found = device;
            finish({ device: found });
          }
        }
      });

      this.scanTimer = setTimeout(() => finish({ device: null }), 8000);
    });
  }

  private teardown() {
    if (this.scanTimer) clearTimeout(this.scanTimer);
    if (this.subId && this.device) {
      this.device.cancelConnection().catch(() => {});
    }
    this.manager?.destroy();
    this.manager = null;
    this.device = null;
    this.subId = null;
  }
}
