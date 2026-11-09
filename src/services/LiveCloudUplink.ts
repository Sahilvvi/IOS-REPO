/**
 * Mirrors live sensor readings from real Bluetooth hardware into Supabase
 * (public.live_readings, see supabase/live_readings.sql).
 *
 * Stored at 1 Hz to keep the table a sensible size: the full 10 Hz recording
 * stays in the local session CSV. RLS scopes every row to the signed-in account.
 *
 * Best effort and never blocking: while the network is down readings wait in a
 * bounded queue, and the oldest are dropped if it fills up.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { pushLiveReadings, pushProfile, type LiveReading } from './CloudSyncService';
import type { Profile } from './ProfileService';

const SAMPLE_MS = 1000;
const FLUSH_MS = 5000;
const MAX_BATCH = 200;
const MAX_QUEUE = 1800; // about 30 minutes at 1 Hz

class LiveCloudUplink {
  private queue: LiveReading[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private profile: Profile | null = null;
  private lastSampleMs = 0;
  // The patients row must exist before readings can reference it.
  private uploadedProfile: string | null = null;

  /** Queued readings belong to one patient, so switching patient drops them. */
  setProfile(profile: Profile | null) {
    if (profile?.id !== this.profile?.id) this.queue = [];
    this.profile = profile;
  }

  /** `pressure` is one zero-corrected frame, the same values the session CSV records. */
  add(pressure: number[]) {
    if (!isSupabaseConfigured || !this.profile) return;
    const now = Date.now();
    if (now - this.lastSampleMs < SAMPLE_MS) return;
    this.lastSampleMs = now;
    this.queue.push({ recorded_at: new Date(now).toISOString(), pressure: [...pressure] });
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
  }

  start() {
    if (!this.timer) this.timer = setInterval(() => void this.flush(), FLUSH_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.queue = [];
  }

  private async flush() {
    const profile = this.profile;
    if (this.busy || this.queue.length === 0 || !profile) return;
    this.busy = true;
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) {
        this.queue = []; // signed out: nothing may be sent
        this.uploadedProfile = null;
        return;
      }

      const uploadKey = `${userId}:${profile.id}`;
      if (this.uploadedProfile !== uploadKey) {
        const err = await pushProfile(profile);
        if (err) return; // already logged; try again on the next flush
        this.uploadedProfile = uploadKey;
      }

      const batch = this.queue.slice(0, MAX_BATCH);
      const err = await pushLiveReadings(batch, profile.id, userId);
      // Removed only after success, and only if nothing replaced the queue meanwhile.
      if (!err && this.queue[0] === batch[0]) this.queue.splice(0, batch.length);
    } finally {
      this.busy = false;
    }
  }
}

export const liveCloudUplink = new LiveCloudUplink();
