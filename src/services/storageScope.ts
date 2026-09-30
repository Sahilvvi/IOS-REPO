/**
 * Per-account local storage.
 *
 * Profiles (SecureStore) and session files (document directory) used to live
 * under one global key/folder, so a second account signing in on the same
 * phone saw - and tried to cloud-sync - the first account's data. Everything
 * is now namespaced by the signed-in user's id. AuthContext calls
 * setStorageScope() whenever the session changes.
 *
 * Data written by older builds (the un-namespaced key/folder) is adopted once,
 * by the first account that signs in after the update.
 */
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

const LEGACY_PROFILE_KEY = 'ava_fit_profiles';
const CLAIM_KEY = 'ava_fit_legacy_claimed_by';
const ROOT = FileSystem.documentDirectory;

let scope = 'anon';
let claim: Promise<void> | null = null;

export function setStorageScope(userId: string | null | undefined): void {
  const next = userId || 'anon';
  if (next === scope) return;
  scope = next;
  claim = null;
}

export function profileKey(): string {
  return scope === 'anon' ? LEGACY_PROFILE_KEY : `${LEGACY_PROFILE_KEY}_${scope}`;
}

export function sessionDir(): string {
  return scope === 'anon' ? `${ROOT}sessions/` : `${ROOT}sessions_${scope}/`;
}

/** Resolves once legacy (pre-scoping) data has been moved under the current
 * account. Await before the first read/write of profiles or sessions. */
export function claimLegacyData(): Promise<void> {
  if (scope === 'anon') return Promise.resolve();
  if (!claim) claim = adoptLegacy(scope).catch(e => console.warn('[storageScope] legacy migration failed:', e));
  return claim;
}

async function adoptLegacy(uid: string): Promise<void> {
  if (await SecureStore.getItemAsync(CLAIM_KEY).catch(() => null)) return;

  const scopedKey = `${LEGACY_PROFILE_KEY}_${uid}`;
  const legacyProfiles = await SecureStore.getItemAsync(LEGACY_PROFILE_KEY).catch(() => null);
  if (legacyProfiles && !(await SecureStore.getItemAsync(scopedKey).catch(() => null))) {
    await SecureStore.setItemAsync(scopedKey, legacyProfiles);
  }

  const legacyDir = `${ROOT}sessions/`;
  const targetDir = `${ROOT}sessions_${uid}/`;
  const [from, to] = await Promise.all([FileSystem.getInfoAsync(legacyDir), FileSystem.getInfoAsync(targetDir)]);
  if (from.exists && !to.exists) await FileSystem.moveAsync({ from: legacyDir, to: targetDir });

  // Only mark as claimed once everything above succeeded, so a failure retries.
  await SecureStore.setItemAsync(CLAIM_KEY, uid);
  if (legacyProfiles) await SecureStore.deleteItemAsync(LEGACY_PROFILE_KEY).catch(() => {});
}
