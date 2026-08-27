/**
 * Patient profile management — CRUD profiles stored in SecureStore.
 */
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { pushProfile, deleteProfileCloud } from './CloudSyncService';

const PROFILE_KEY = 'ava_fit_profiles';
const SOCKET_DIR = `${FileSystem.documentDirectory}sockets/`;

export interface ProfileCalibration {
 distal_offset?: number;
 rotational_offset?: number;
 row_spacing?: number;
 /** Per-channel zero/tare baseline captured by Settings' "Zero / Tare" —
  * mirrors desktop's engine.zero_calibrate(), one-time tare, not continuous. */
 zero_offsets?: number[] | null;
}

export interface Profile {
 id: string;
 name: string;
 patient_id: string;
 grid: { rows: number; cols: number };
 mapping: { method: string; coverage: number; offset: number };
 max_kpa: number;
 device: {
 device_names: string[];
 service_uuid: string;
 pressure_char_uuid: string;
 imu_char_uuid: string;
 scan_timeout: number;
 retry_delay: number;
 };
 calibration?: ProfileCalibration;
 /** Local file URI of this patient's imported socket scan (.stl/.obj), copied
  * into the app's document directory. Absent = use the bundled default mesh. */
 socket_uri?: string;
 socket_name?: string;
 created_at: number;
}

export function createProfileData(name: string, patient_id: string): Profile {
 return {
 id: `${Date.now()}`,
 name,
 patient_id,
 grid: { rows: 3, cols: 6 },
 mapping: { method: 'cylindrical', coverage: 0.85, offset: 2.0 },
 max_kpa: 50,
 device: {
 device_names: ['PROJECT-X-MCU', 'PROJECT-X-MCU-LEGACY', 'PROJECT-X-18Node'],
 service_uuid: 'abcd0001-1111-2222-3333-abcdefabcdef',
 pressure_char_uuid: 'abcd0002-1111-2222-3333-abcdefabcdef',
 imu_char_uuid: 'abcd0003-1111-2222-3333-abcdefabcdef',
 scan_timeout: 6.0,
 retry_delay: 5.0,
 },
 created_at: Date.now(),
 };
}

export async function listProfiles(): Promise<Profile[]> {
 try {
 const raw = await SecureStore.getItemAsync(PROFILE_KEY);
 if (!raw) return [];
 return JSON.parse(raw);
 } catch {
 return [];
 }
}

export async function saveProfile(profile: Profile): Promise<void> {
 const profiles = await listProfiles();
 const idx = profiles.findIndex(p => p.id === profile.id);
 if (idx >= 0) {
 profiles[idx] = profile;
 } else {
 profiles.push(profile);
 }
 try {
 await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profiles));
 } catch (e) {
 // expo-secure-store's web shim is incomplete on some SDK/browser combos
 // (missing native keychain, obviously) — on-device iOS/Android this is
 // backed by Keychain/Keystore and doesn't throw. Don't let a persistence
 // failure take down the whole provider tree on mount.
 console.warn('[ProfileService] saveProfile failed to persist:', e);
 }
 pushProfile(profile); // fire-and-forget cloud mirror
}

export async function deleteProfile(id: string): Promise<void> {
 const profiles = await listProfiles();
 const filtered = profiles.filter(p => p.id !== id);
 try {
 await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(filtered));
 } catch (e) {
 console.warn('[ProfileService] deleteProfile failed to persist:', e);
 }
 deleteProfileCloud(id);
}

export async function getProfile(id: string): Promise<Profile | null> {
 const profiles = await listProfiles();
 return profiles.find(p => p.id === id) || null;
}

/**
 * Copy a picked STL/OBJ into this profile's stable local storage location and
 * return the updated profile fields. Caller is responsible for persisting
 * via updateActiveProfile/saveProfile — mirrors desktop's profiles.py
 * _import_socket (copy into a per-profile home, don't just reference the
 * original picker URI which can vanish once the picker sheet closes).
 */
export async function importSocketFile(
 profileId: string,
 pickedUri: string,
 pickedName: string,
): Promise<Pick<Profile, 'socket_uri' | 'socket_name'>> {
 await FileSystem.makeDirectoryAsync(SOCKET_DIR, { intermediates: true }).catch(() => {});
 const ext = (pickedName.split('.').pop() || 'stl').toLowerCase();
 const dest = `${SOCKET_DIR}${profileId}.${ext}`;
 await FileSystem.copyAsync({ from: pickedUri, to: dest });
 return { socket_uri: dest, socket_name: pickedName };
}

export async function clearSocketFile(profile: Profile): Promise<void> {
 if (profile.socket_uri) {
 await FileSystem.deleteAsync(profile.socket_uri, { idempotent: true }).catch(() => {});
 }
}
