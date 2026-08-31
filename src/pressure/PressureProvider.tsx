import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';

import { derive, deriveClinical, FitReading, resetDerive, setKalmanTuning as applyKalmanTuning } from './derive';
import { SimulatedPressureSource } from './SimulatedPressureSource';
import { PressureFrame, PressureSource, SENSOR_COUNT, BASELINE_KPA } from './types';
import { BlePressureSource, DEVICE_NAMES, BleStatus } from './BlePressureSource';
import { KalmanTuning } from './kalmanFilter';
import { useProfile } from '@/context/ProfileContext';
import * as sessionLogger from './sessionLogger';

export interface ClinicalReading {
  available: boolean;
  overallLevel: string;
  regions: any[];
  window_s: number;
  suggestions: any[];
}

const NO_CLINICAL_DATA: ClinicalReading = {
  available: false,
  overallLevel: 'low',
  regions: [],
  window_s: 0,
  suggestions: [],
};

interface SessionApi {
  active: boolean;
  startSession: (subjectId?: string, notes?: string) => Promise<boolean>;
  stopSession: (notes?: string) => Promise<string | null>;
}

const DEFAULT_KALMAN: KalmanTuning = {
  qTrue: 0.08,
  qDriftActive: 0.15,
  qDriftIdle: 0.02,
  rMeas: 0.4,
  driftThreshold: 2.0,
  driftEngageN: 20,
};

const KALMAN_KEY = 'ava_fit_kalman';
const BLE_KEY = 'ava_fit_ble_enabled';

export interface DeviceApi {
  /** Live BLE toggle + connection status — actually drives BlePressureSource,
   * not a cosmetic timer. */
  useBle: boolean;
  bleStatus: BleStatus | 'idle';
  toggleBle: () => void;
  /** Zero/tare, scoped to the active profile (mirrors desktop's per-profile
   * calibration.zero_offsets) — a one-time baseline capture, not continuous
   * auto-zero, so a real load applied afterward is never masked. */
  hasZeroCalibration: boolean;
  zeroCalibrate: () => void;
  clearZeroCalibration: () => void;
  kalman: KalmanTuning;
  setKalman: (k: Partial<KalmanTuning>) => void;
  resetKalman: () => void;
}

// `undefined` (not `null`) is the "used outside <PressureProvider>" sentinel — the
// Provider's real value is always a concrete object, even before the first frame
// has been clinically analysed, so a `null`/falsy check can never mistake
// "no data yet" for "not wrapped".
const PressureContext = createContext<FitReading | undefined>(undefined);
const ClinicalContext = createContext<ClinicalReading | undefined>(undefined);
const SessionContext = createContext<SessionApi | undefined>(undefined);
const DeviceContext = createContext<DeviceApi | undefined>(undefined);

async function saveJson(key: string, value: unknown) {
  try { await SecureStore.setItemAsync(key, JSON.stringify(value)); } catch {}
}

export function PressureProvider({ children }: { children: React.ReactNode }) {
  // PressureProvider is mounted inside <ProfileProvider> (see app/_layout.tsx),
  // so it can read/write the active profile directly — that's what makes
  // zero-calibration and grid/mapping settings actually per-patient instead
  // of a single global toggle nobody's data model expects.
  const { activeProfile, updateActiveProfile } = useProfile();

  const [useBle, setUseBle] = useState(false);
  const [bleStatus, setBleStatus] = useState<BleStatus | 'idle'>('idle');
  const simSource = useMemo(() => new SimulatedPressureSource(460), []);
  const bleSource = useMemo(() => new BlePressureSource(simSource), [simSource]);
  const active = useMemo(() => (useBle ? bleSource : simSource), [useBle, simSource, bleSource]);

  const [frame, setFrame] = useState<PressureFrame>(() => [...BASELINE_KPA]);
  const [clinical, setClinical] = useState<ClinicalReading>(NO_CLINICAL_DATA);
  const [sessionActive, setSessionActive] = useState(false);
  const [kalman, setKalmanState] = useState<KalmanTuning>(DEFAULT_KALMAN);

  const lastRawFrame = useRef<number[]>([...BASELINE_KPA]);
  const zeroOffsets = activeProfile?.calibration?.zero_offsets ?? null;
  const hasZeroCalibration = Array.isArray(zeroOffsets) && zeroOffsets.length === SENSOR_COUNT;
  // Read inside the frame-subscription callback via a ref, not a hook dep —
  // re-subscribing `active` (esp. BlePressureSource) on every zero-cal change
  // would force a full BLE re-scan/reconnect for what should be a silent
  // per-sample correction.
  const zeroOffsetsRef = useRef<number[] | null>(null);
  zeroOffsetsRef.current = hasZeroCalibration ? (zeroOffsets as number[]) : null;

  // Build initial reading
  const reading = useMemo(() => derive(frame), [frame]);

  // ---- Load persisted global device settings once on mount ----
  useEffect(() => {
    (async () => {
      // expo-secure-store has no web implementation (throws synchronously
      // rather than rejecting) — guard so a web preview doesn't take the
      // whole provider tree down before it renders.
      try {
        const [savedKalman, savedBle] = await Promise.all([
          SecureStore.getItemAsync(KALMAN_KEY),
          SecureStore.getItemAsync(BLE_KEY),
        ]);
        if (savedKalman) {
          try {
            const parsed = { ...DEFAULT_KALMAN, ...JSON.parse(savedKalman) };
            setKalmanState(parsed);
            applyKalmanTuning(parsed);
          } catch {}
        }
        if (savedBle === 'true') setUseBle(true);
      } catch {}
    })();
  }, []);

  // ---- Live pressure subscription: apply zero offset, feed derive + logger ----
  useEffect(() => {
    let cancelled = false;
    const sub = active.subscribe((rawFrame) => {
      if (cancelled) return;
      lastRawFrame.current = [...rawFrame];

      const offsets = zeroOffsetsRef.current;
      const corrected = offsets
        ? rawFrame.map((v, i) => Math.max(0, v - (offsets[i] ?? 0)))
        : rawFrame;

      setFrame([...corrected]);

      if (sessionLogger.isActive()) {
        // Real IMU passthrough needs BlePressureSource to surface the `I:` fields it
        // already parses out of the wire frame — simulated sessions log pressure only.
        sessionLogger.record(corrected, {}, active.id);
      }

      deriveClinical(corrected).then((result) => {
        if (!cancelled && result) {
          setClinical({
            available: result.risk.available,
            overallLevel: result.risk.overallLevel,
            regions: result.risk.regions,
            window_s: result.risk.window_s,
            suggestions: result.suggestions,
          });
        }
      });
    });
    return () => {
      cancelled = true;
      sub();
    };
  }, [active]);

  // ---- BLE connection status ----
  useEffect(() => {
    if (!useBle) { setBleStatus('idle'); return; }
    return bleSource.onStatusChange(setBleStatus);
  }, [useBle, bleSource]);

  const toggleBle = useCallback(() => {
    setUseBle((prev) => {
      const next = !prev;
      if (next) {
        resetDerive();
        setFrame([...BASELINE_KPA]);
        setClinical(NO_CLINICAL_DATA);
      }
      saveJson(BLE_KEY, String(next));
      return next;
    });
  }, []);

  const zeroCalibrate = useCallback(() => {
    const offsets = [...lastRawFrame.current];
    updateActiveProfile({
      calibration: { ...(activeProfile?.calibration ?? {}), zero_offsets: offsets },
    });
  }, [activeProfile, updateActiveProfile]);

  const clearZeroCalibration = useCallback(() => {
    updateActiveProfile({
      calibration: { ...(activeProfile?.calibration ?? {}), zero_offsets: null },
    });
  }, [activeProfile, updateActiveProfile]);

  const setKalman = useCallback((partial: Partial<KalmanTuning>) => {
    setKalmanState((prev) => {
      const next = { ...prev, ...partial };
      applyKalmanTuning(next);
      saveJson(KALMAN_KEY, next);
      return next;
    });
  }, []);

  const resetKalman = useCallback(() => {
    setKalmanState(DEFAULT_KALMAN);
    applyKalmanTuning(DEFAULT_KALMAN);
    saveJson(KALMAN_KEY, DEFAULT_KALMAN);
  }, []);

  const startSession = useCallback(async (subjectId = 'unknown', notes = '') => {
    const ok = await sessionLogger.startSession(subjectId, notes);
    if (ok) setSessionActive(true);
    return ok;
  }, []);

  const stopSession = useCallback(async (notes = '') => {
    const id = await sessionLogger.endSession(notes);
    setSessionActive(false);
    return id;
  }, []);

  const sessionApi = useMemo<SessionApi>(
    () => ({ active: sessionActive, startSession, stopSession }),
    [sessionActive, startSession, stopSession],
  );

  const deviceApi = useMemo<DeviceApi>(
    () => ({
      useBle, bleStatus, toggleBle,
      hasZeroCalibration, zeroCalibrate, clearZeroCalibration,
      kalman, setKalman, resetKalman,
    }),
    [useBle, bleStatus, toggleBle, hasZeroCalibration, zeroCalibrate, clearZeroCalibration,
      kalman, setKalman, resetKalman],
  );

  return (
    <PressureContext.Provider value={reading}>
      <ClinicalContext.Provider value={clinical}>
        <SessionContext.Provider value={sessionApi}>
          <DeviceContext.Provider value={deviceApi}>{children}</DeviceContext.Provider>
        </SessionContext.Provider>
      </ClinicalContext.Provider>
    </PressureContext.Provider>
  );
}

export function useFitReading(): FitReading {
  const ctx = useContext(PressureContext);
  if (ctx === undefined) throw new Error('useFitReading must be used inside <PressureProvider>');
  return ctx;
}

export function useClinicalReading(): ClinicalReading {
  const ctx = useContext(ClinicalContext);
  if (ctx === undefined) throw new Error('useClinicalReading must be used inside <PressureProvider>');
  return ctx;
}

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (ctx === undefined) throw new Error('useSession must be used inside <PressureProvider>');
  return ctx;
}

export function useDevice(): DeviceApi {
  const ctx = useContext(DeviceContext);
  if (ctx === undefined) throw new Error('useDevice must be used inside <PressureProvider>');
  return ctx;
}

export { DEVICE_NAMES };
