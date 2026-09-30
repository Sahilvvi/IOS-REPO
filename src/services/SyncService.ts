/**
 * Reconciles local profiles/sessions with Supabase.
 *
 * CloudSyncService pushes are single fire-and-forget attempts, so anything
 * that failed (offline, expired token, profile not uploaded yet) or was saved
 * before sign-in never reached the cloud. syncPending() is idempotent: it
 * upserts every local profile, then inserts any local session whose
 * session_code is not already in the cloud. Safe to call repeatedly.
 */
import { listProfiles, type Profile } from './ProfileService';
import { listSessions } from './SessionService';
import { pushProfile, pushSession, listCloudSessionCodes } from './CloudSyncService';

export interface SyncResult {
  ok: boolean;
  profiles: number;
  sessions: number;
  errors: string[];
}

let inFlight: Promise<SyncResult> | null = null;

export function syncPending(): Promise<SyncResult> {
  if (!inFlight) inFlight = run().finally(() => { inFlight = null; });
  return inFlight;
}

async function run(): Promise<SyncResult> {
  const result: SyncResult = { ok: true, profiles: 0, sessions: 0, errors: [] };

  const profiles = await listProfiles();
  // Profiles first: sessions.patient_id is a foreign key to patients.
  const uploaded = new Set<string>();
  for (const p of profiles) {
    const err = await pushProfile(p);
    if (err) {
      result.errors.push(`profile ${p.id}: ${err}`);
    } else {
      uploaded.add(p.id);
      result.profiles++;
    }
  }

  const cloudCodes = await listCloudSessionCodes();
  if (!cloudCodes) {
    result.errors.push('could not read cloud sessions');
    result.ok = false;
    return result;
  }

  for (const meta of await listSessions()) {
    if (cloudCodes.has(meta.id)) continue;
    // SessionMeta.subjectId is the profile's patient_id code, not its local id.
    // Only legacy sessions recorded without a subject fall back to the first
    // profile; a session whose profile was deleted locally is skipped rather
    // than attributed to the wrong patient.
    const owner: Profile | undefined =
      profiles.find(p => p.patient_id === meta.subjectId) ??
      (meta.subjectId === 'unknown' ? profiles[0] : undefined);
    if (!owner) continue;
    if (!uploaded.has(owner.id)) {
      result.errors.push(`session ${meta.id}: patient profile not uploaded`);
      continue;
    }
    const err = await pushSession(meta, owner.id);
    if (err) result.errors.push(`session ${meta.id}: ${err}`);
    else result.sessions++;
  }

  result.ok = result.errors.length === 0;
  if (result.errors.length) console.warn('[SyncService] finished with errors:', result.errors);
  return result;
}
