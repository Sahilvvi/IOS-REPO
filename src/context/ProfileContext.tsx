import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { listProfiles, saveProfile, createProfileData, type Profile } from '@/services/ProfileService';

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
 const [profiles, setProfiles] = useState<Profile[]>([]);
 const [activeId, setActiveId] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 (async () => {
 const list = await listProfiles();
 setProfiles(list);
 if (list.length > 0) {
 setActiveId(list[0].id);
 } else {
 const def = createProfileData('Patient', 'P001');
 await saveProfile(def);
 setProfiles([def]);
 setActiveId(def.id);
 }
 setLoading(false);
 })();
 }, []);

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
