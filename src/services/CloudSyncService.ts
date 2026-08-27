/**
 * Cloud sync — best-effort mirror of local profiles/sessions into Supabase.
 *
 * Mirrors the desktop app's cloud_sync.py: same tables, same RLS-scoped
 * ownership. Every call here is fire-and-forget and swallows errors — local
 * SecureStore/FileSystem storage (ProfileService.ts, sessionLogger.ts) stays
 * the source of truth, this is a mirror for cross-device access only.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { Profile } from './ProfileService';
import type { SessionMeta } from './SessionService';

/** Local profile ids are `${Date.now()}` strings — not valid Postgres uuids.
 * Deterministically derive a stable uuid-shaped id from it so the same local
 * profile always maps to the same cloud row (a poor-man's uuid v5 substitute
 * that avoids pulling in a crypto/uuid dependency for one field). */
function patientUuid(localId: string): string {
 // Pad/hash the numeric-ish local id into 32 hex chars, then format as a uuid.
 let h = 0;
 for (let i = 0; i < localId.length; i++) {
 h = (h * 31 + localId.charCodeAt(i)) >>> 0;
 }
 const hex = (h.toString(16).padStart(8, '0') + localId.replace(/[^0-9a-f]/gi, '').padStart(24, '0')).slice(0, 32).padEnd(32, '0');
 return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function currentUserId(): Promise<string | null> {
 if (!isSupabaseConfigured) return null;
 const { data } = await supabase.auth.getUser();
 return data.user?.id ?? null;
}

export async function pushProfile(profile: Profile): Promise<void> {
 try {
 const ownerId = await currentUserId();
 if (!ownerId) return;
 const { error } = await supabase.from('patients').upsert({
 id: patientUuid(profile.id),
 owner_id: ownerId,
 name: profile.name,
 patient_code: profile.patient_id,
 grid_rows: profile.grid.rows,
 grid_cols: profile.grid.cols,
 mapping_method: profile.mapping.method,
 mapping_coverage: profile.mapping.coverage,
 mapping_offset: profile.mapping.offset,
 max_kpa: profile.max_kpa,
 device_names: profile.device.device_names,
 service_uuid: profile.device.service_uuid,
 pressure_char_uuid: profile.device.pressure_char_uuid,
 imu_char_uuid: profile.device.imu_char_uuid,
 scan_timeout: profile.device.scan_timeout,
 retry_delay: profile.device.retry_delay,
 });
 if (error) console.warn('[CloudSync] pushProfile failed:', error.message);
 } catch (e) {
 console.warn('[CloudSync] pushProfile error:', e);
 }
}

export async function deleteProfileCloud(profileId: string): Promise<void> {
 try {
 const ownerId = await currentUserId();
 if (!ownerId) return;
 await supabase.from('patients').delete().eq('id', patientUuid(profileId));
 } catch (e) {
 console.warn('[CloudSync] deleteProfile error:', e);
 }
}

export async function pushSession(meta: SessionMeta, patientLocalId: string): Promise<void> {
 try {
 const ownerId = await currentUserId();
 if (!ownerId) return;
 const { error } = await supabase.from('sessions').insert({
 patient_id: patientUuid(patientLocalId),
 owner_id: ownerId,
 session_code: meta.id,
 source_device: 'ios',
 start_ms: meta.startMs,
 end_ms: meta.endMs,
 duration_s: meta.durationSec,
 row_count: meta.rows,
 notes: meta.notes,
 });
 if (error) console.warn('[CloudSync] pushSession failed:', error.message);
 } catch (e) {
 console.warn('[CloudSync] pushSession error:', e);
 }
}

export async function pushUserSettings(data: {
 pressure_unit?: string;
 session_sample_hz?: number;
 num_rows?: number;
 num_cols?: number;
 max_kpa?: number;
 theme?: string;
}): Promise<void> {
 try {
 const ownerId = await currentUserId();
 if (!ownerId) return;
 const { error } = await supabase.from('user_settings').upsert({ user_id: ownerId, ...data });
 if (error) console.warn('[CloudSync] pushUserSettings failed:', error.message);
 } catch (e) {
 console.warn('[CloudSync] pushUserSettings error:', e);
 }
}
