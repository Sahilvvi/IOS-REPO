import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { listProfiles, saveProfile, createProfileData, type Profile } from '@/services/ProfileService';
import { useAuth } from '@/context/AuthContext';

interface ProfileState {
 profiles: Profile[];
 activeProfile: Profile | null;
 setActiveProfile: (id: string) => void;
 createProfile: (name: string) => Promise<Profile>;
 /** Merge a partial patch into the active profile and persist it — the one
  * path Settings/Fit use to edit grid, mapping, calibration, or socket file. */
 updateActiveProfile: (patch: Partial<Profile>) => Promise<void>;
 loading: boolean;
}

const ProfileContext = React.createContext<ProfileState>({
 profiles: [],
 activeProfile: null,
 setActiveProfile: () => {},
 createProfile: async () => createProfileData('', ''),
 updateActiveProfile: async () => {},
 loading: true,
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
 // ProfileProvider is mounted unconditionally above Gate, so without this it
 // was racing AuthProvider's async session fetch — this effect used to run
 // on the very first render, always seeing the default `session: null`, so
 // the first-ever profile it created was permanently named 'Patient'
 // regardless of who actually signed up. Waiting for auth to resolve first
 // lets it read the real name (or at least the real email) instead.
 const { session, loading: authLoading } = useAuth();
 const [profiles, setProfiles] = useState<Profile[]>([]);
 const [activeId, setActiveId] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 if (authLoading) return;
 (async () => {
 const list = await listProfiles();
 setProfiles(list);
 if (list.length > 0) {
 setActiveId(list[0].id);
 } else {
 const metadataName = session?.user?.user_metadata?.full_name;
 const fallbackName =
 (typeof metadataName === 'string' ? metadataName.trim() : '') ||
 session?.user?.email?.split('@')[0] ||
 'Patient';
 const def = createProfileData(fallbackName, 'P001');
 await saveProfile(def);
 setProfiles([def]);
 setActiveId(def.id);
 }
 setLoading(false);
 })();
 }, [authLoading, session?.user?.id]);

 const activeProfile = profiles.find(p => p.id === activeId) ?? null;

 const setActive = (id: string) => setActiveId(id);

 const createProfile = async (name: string) => {
 const p = createProfileData(name, `P${Date.now().toString(36).toUpperCase()}`);
 await saveProfile(p);
 setProfiles(prev => [...prev, p]);
 setActiveId(p.id);
 return p;
 };

 const updateActiveProfile = useCallback(async (patch: Partial<Profile>) => {
 setProfiles(prev => {
 const idx = prev.findIndex(p => p.id === activeId);
 if (idx < 0) return prev;
 const updated = { ...prev[idx], ...patch };
 saveProfile(updated);
 const next = [...prev];
 next[idx] = updated;
 return next;
 });
 }, [activeId]);

 return (
 <ProfileContext.Provider value={{ profiles, activeProfile, setActiveProfile: setActive, createProfile, updateActiveProfile, loading }}>
 {children}
 </ProfileContext.Provider>
 );
}

export function useProfile() {
 return useContext(ProfileContext);
}
