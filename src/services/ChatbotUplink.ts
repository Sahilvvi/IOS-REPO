/**
 * Sends live sensor readings from real Bluetooth hardware to the AVA Fit
 * assistant (the chatbot), so it can answer about pressure and alerts right now.
 *
 * Signs in with the same Supabase account the app already uses: no shared key is
 * stored in the app. The server only accepts readings for the patient linked to
 * this account (patient_logins.owner_id), so a stolen or shared build can't write
 * to anyone else's record.
 *
 * Best effort and never blocking: if the server is asleep or unreachable the
 * oldest readings are dropped and the app carries on.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';

const BASE_URL = (process.env.EXPO_PUBLIC_ASSISTANT_URL ?? 'https://ava-fit-assistant.onrender.com').replace(/\/$/, '');
const SENSOR_COUNT = 18;
const FLUSH_MS = 2000;
const MAX_BATCH = 400; // the server's limit is 500 per request
const MAX_QUEUE = 1500; // about 2.5 minutes at 10 Hz
const RETRY_UNLINKED_MS = 60_000;
const REQUEST_TIMEOUT_MS = 8000;

export type UplinkStatus = 'idle' | 'sending' | 'not-linked' | 'error';

type Sample = { ts: number; pressure: number[] };

async function call(path: string, token: string, body?: unknown): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(BASE_URL + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

class ChatbotUplink {
  status: UplinkStatus = 'idle';

  private queue: Sample[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private linked: { userId: string; code: string } | null = null;
  private unlinkedUntil: { userId: string; until: number } | null = null;

  /** `raw` is one frame straight from the sensor, in the order the firmware sends it. */
  add(raw: number[]) {
    if (!isSupabaseConfigured || raw.length !== SENSOR_COUNT) return;
    this.queue.push({ ts: Date.now() / 1000, pressure: [...raw] });
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
  }

  start() {
    if (!this.timer) this.timer = setInterval(() => void this.flush(), FLUSH_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.queue = [];
    this.status = 'idle';
  }

  private async flush() {
    if (this.busy || this.queue.length === 0) return;
    this.busy = true;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const userId = data.session?.user.id;
      if (!token || !userId) {
        this.queue = []; // signed out: nothing may be sent
        this.status = 'idle';
        return;
      }

      if (this.linked?.userId !== userId) {
        this.linked = null;
        if (this.unlinkedUntil?.userId === userId && this.unlinkedUntil.until > Date.now()) {
          this.queue = [];
          return;
        }
        const me = await call('/phone/me', token);
        if (me.status === 404) {
          this.unlinkedUntil = { userId, until: Date.now() + RETRY_UNLINKED_MS };
          this.queue = [];
          this.status = 'not-linked';
          return;
        }
        if (!me.ok) throw new Error(`link check ${me.status}`);
        this.linked = { userId, code: (await me.json()).patient_code };
        this.unlinkedUntil = null;
      }

      const batch = this.queue.splice(0, MAX_BATCH);
      this.status = 'sending';
      const res = await call('/ingest/phone', token, { patient_id: this.linked.code, source: 'ble', samples: batch });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) this.linked = null; // re-check the link next time
        this.queue = batch.concat(this.queue).slice(-MAX_QUEUE);
        throw new Error(`send ${res.status}`);
      }
    } catch (e) {
      this.status = 'error';
      if (__DEV__) console.log('[ChatbotUplink]', String(e));
    } finally {
      this.busy = false;
    }
  }
}

export const chatbotUplink = new ChatbotUplink();
