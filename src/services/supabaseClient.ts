/**
 * Supabase client — shared connection to the "Quorum Prosthetic" project.
 *
 * The anon/publishable key is safe to ship in the app binary: every table is
 * RLS-scoped to auth.uid(), so a signed-in user can only ever read/write
 * their own rows (see the schema in the desktop app's cloud_sync.py).
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Fallback values for EXPO_PUBLIC_* env vars. These are only ever reached if
// the build pipeline didn't inline the env vars at bundle time (e.g. an EAS
// build archived only git-tracked files while `.env` stayed gitignored, as
// happened for the first TestFlight build — login silently ran in
// "not configured" mode with no env-var mismatch visible anywhere). Safe to
// hardcode: this is the anon/publishable key, not a secret (see file header).
const FALLBACK_SUPABASE_URL = 'https://pzwsehbrstvjkqpxwyod.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_Rwcryruz2Dnmfb8X320n7w_EZuyBTPx';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? FALLBACK_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
 console.warn('[supabaseClient] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing — cloud sync disabled.');
}

// Expo Router evaluates the root layout (and everything it imports) once in
// a plain-Node server bundle too, e.g. for +api routes / static rendering —
// not just in the real browser/React Native runtime. `@react-native-async-
// storage/async-storage`'s web shim reaches for `window.localStorage`
// unconditionally, which crashes the ENTIRE dev server with "window is not
// defined" the instant supabase-js's GoTrueClient auto-initializes and
// calls storage.getItem(). React Native itself polyfills `global.window =
// global` (for libraries that gate on `typeof window`), and browsers obviously
// have it — plain Node (Metro's server bundle target) is the only environment
// where `window` is truly absent, so it's a safe discriminator to no-op
// storage there. (`navigator` doesn't work for this: Metro's server bundle
// polyfills that one too, so it can't tell the two apart.)
const isServerBundle = typeof window === 'undefined';
const safeStorage = {
 getItem: (key: string) => (isServerBundle ? Promise.resolve(null) : AsyncStorage.getItem(key)),
 setItem: (key: string, value: string) => (isServerBundle ? Promise.resolve() : AsyncStorage.setItem(key, value)),
 removeItem: (key: string) => (isServerBundle ? Promise.resolve() : AsyncStorage.removeItem(key)),
};

export const supabase = createClient(
 supabaseUrl || 'https://placeholder.supabase.co',
 supabaseAnonKey || 'placeholder',
 {
 auth: {
 storage: safeStorage,
 autoRefreshToken: !isServerBundle,
 persistSession: !isServerBundle,
 detectSessionInUrl: false,
 },
 },
);
