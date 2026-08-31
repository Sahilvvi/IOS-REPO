import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

const ONBOARDED_KEY = 'ava_fit_onboarded';

interface OnboardingState {
  /** `null` while the flag is still being read from storage. */
  hasOnboarded: boolean | null;
  complete: () => void;
}

const OnboardingContext = createContext<OnboardingState>({
  hasOnboarded: null,
  complete: () => {},
});

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    // expo-secure-store has no web implementation at all (throws
    // synchronously rather than just rejecting) — this app targets native
    // iOS, but guard anyway so a `expo start --web` preview doesn't die on
    // this before anything renders.
    (async () => {
      try {
        const v = await SecureStore.getItemAsync(ONBOARDED_KEY);
        setHasOnboarded(v === 'true');
      } catch {
        setHasOnboarded(false);
      }
    })();
  }, []);

  const complete = useCallback(() => {
    setHasOnboarded(true);
    try {
      SecureStore.setItemAsync(ONBOARDED_KEY, 'true').catch(() => {});
    } catch {}
  }, []);

  return (
    <OnboardingContext.Provider value={{ hasOnboarded, complete }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
