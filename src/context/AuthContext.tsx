import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/services/supabaseClient';
import { signIn as authSignIn, signUp as authSignUp, signOut as authSignOut } from '@/services/AuthService';

interface AuthState {
 session: Session | null;
 loading: boolean;
 configured: boolean;
 signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
 signUp: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
 signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
 session: null,
 loading: true,
 configured: isSupabaseConfigured,
 signIn: async () => ({ ok: false, error: 'not ready' }),
 signUp: async () => ({ ok: false, error: 'not ready' }),
 signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
 const [session, setSession] = useState<Session | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (!isSupabaseConfigured) {
 setLoading(false);
 return;
 }
 supabase.auth.getSession().then(({ data }) => {
 setSession(data.session);
 setLoading(false);
 });
 const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
 setSession(newSession);
 });
 return () => sub.subscription.unsubscribe();
 }, []);

 const value: AuthState = {
 session,
 loading,
 configured: isSupabaseConfigured,
 signIn: authSignIn,
 signUp: authSignUp,
 signOut: authSignOut,
 };

 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
 return useContext(AuthContext);
}
