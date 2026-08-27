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
import { PressureFrame, PressureSource, SENSOR_COUNT } from './types';

// BLE identifiers matching the ESP32-S3 firmware
export const SERVICE_UUID = 'abcd0001-1111-2222-3333-abcdefabcdef';
export const PRESSURE_CHAR_UUID = 'abcd0002-1111-2222-3333-abcdefabcdef';
export const IMU_CHAR_UUID = 'abcd0003-1111-2222-3333-abcdefabcdef';

// Device names to scan for (in priority order)
export const DEVICE_NAMES = [
 'PROJECT-X-MCU',
 'PROJECT-X-MCU-LEGACY',
 'PROJECT-X-18Node',
];

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
 if (vals.length > 0) result.pressure = vals;
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

export class BlePressureSource implements PressureSource {
 readonly id = 'ble';
 private manager: any = null;
 private device: any = null;
 private subId: string | null = null;
 private alive = true;
 private scanTimer: ReturnType<typeof setTimeout> | null = null;
 private status: BleStatus = 'scanning';
 private statusListeners = new Set<(s: BleStatus) => void>();

 constructor(private readonly fallback: PressureSource) {}

 onStatusChange(cb: (s: BleStatus) => void): () => void {
 this.statusListeners.add(cb);
 cb(this.status);
 return () => this.statusListeners.delete(cb);
 }

 private setStatus(s: BleStatus) {
 this.status = s;
 for (const cb of this.statusListeners) cb(s);
 }

 subscribe(onFrame: (frame: PressureFrame) => void): () => void {
 this.setStatus('scanning');
 this.connect(onFrame).catch(() => {
 if (this.alive) {
 this.setStatus('fallback');
 this.fallback.subscribe(onFrame);
 }
 });

 return () => {
 this.alive = false;
 this.teardown();
 };
 }

 private async connect(onFrame: (frame: PressureFrame) => void): Promise<void> {
 try {
 const btReady = await this.waitForBluetooth();
 if (!this.alive) return;
 if (!btReady) {
 this.setStatus('fallback');
 this.fallback.subscribe(onFrame);
 return;
 }

 this.device = await this.findDevice();
 if (!this.device || !this.alive) {
 if (this.alive) { this.setStatus('fallback'); this.fallback.subscribe(onFrame); }
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
 if (this.alive) { this.setStatus('fallback'); this.fallback.subscribe(onFrame); }
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

 this.device.onDisconnected(() => {
 if (this.alive) {
 this.setStatus('scanning');
 this.connect(onFrame).catch(() => {
 if (this.alive) { this.setStatus('fallback'); this.fallback.subscribe(onFrame); }
 });
 }
 });
 } catch {
 if (this.alive) { this.setStatus('fallback'); this.fallback.subscribe(onFrame); }
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
 const device = await this.scan(manager);
 if (device) return device;
 }
 return null;
 }

 private scan(manager: any): Promise<any> {
 return new Promise((resolve) => {
 let found: any = null;

 manager.startDeviceScan(null, null, (error: any, device: any) => {
 if (error || !device) return;
 const name = (device.name ?? device.localName ?? '').toLowerCase();
 if (DEVICE_NAMES.some(dn => name.includes(dn.toLowerCase()))) {
 found = device;
 manager.stopDeviceScan();
 resolve(found);
 }
 });

 this.scanTimer = setTimeout(() => {
 manager.stopDeviceScan();
 resolve(null);
 }, 8000);
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
