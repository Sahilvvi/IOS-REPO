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
// The free Render plan sleeps when idle and takes up to a minute to wake, which a
// person waiting on the link screen must be allowed to sit through.
const INTERACTIVE_TIMEOUT_MS = 75_000;

export type UplinkStatus = 'idle' | 'sending' | 'not-linked' | 'error';

export type LinkResult = { ok: true; code: string; name: string } | { ok: false; error: string };

type Sample = { ts: number; pressure: number[] };

async function call(path: string, token: string, body?: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
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

  /** The clinic record this account sends readings for, or null if none is linked. */
  async linkedPatient(): Promise<LinkResult | null> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: 'Sign in first.' };
    try {
      const res = await call('/phone/me', token, undefined, INTERACTIVE_TIMEOUT_MS);
      if (res.status === 404) return null;
      if (!res.ok) return { ok: false, error: `Server error (${res.status}).` };
      const me = await res.json();
      return { ok: true, code: me.patient_code, name: me.name };
    } catch {
      return { ok: false, error: 'Could not reach the AVA Fit server. Check your internet connection.' };
    }
  }

  /** Links this account to a clinic patient record, proven with that patient's chatbot password. */
  async linkPatient(patientCode: string, password: string): Promise<LinkResult> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: 'Sign in first.' };
    try {
      const res = await call('/phone/link', token, { patient_id: patientCode.trim(), password }, INTERACTIVE_TIMEOUT_MS);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: body.detail ?? `Server error (${res.status}).` };
      // Start sending straight away instead of waiting out the "not linked" back-off.
      this.linked = null;
      this.unlinkedUntil = null;
      return { ok: true, code: body.patient_code, name: body.name };
    } catch {
      return { ok: false, error: 'Could not reach the AVA Fit server. Check your internet connection.' };
    }
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
