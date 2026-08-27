/**
 * Auth service — thin wrapper around Supabase email/password auth.
 */
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';

export async function getSession(): Promise<Session | null> {
 if (!isSupabaseConfigured) return null;
 const { data } = await supabase.auth.getSession();
 return data.session;
}

export async function signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
 if (!isSupabaseConfigured) return { ok: false, error: 'Cloud sync not configured' };
 const { error } = await supabase.auth.signInWithPassword({ email, password });
 return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signUp(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
 if (!isSupabaseConfigured) return { ok: false, error: 'Cloud sync not configured' };
 const { error } = await supabase.auth.signUp({ email, password });
 return error ? { ok: false, error: error.message } : { ok: true };
}

export async function signOut(): Promise<void> {
 if (!isSupabaseConfigured) return;
 await supabase.auth.signOut();
}
