/**
 * Derive all clinical readings from a raw pressure frame.
 *
 * Pipeline:
 * 1. Kalman filter → filtered + drift
 * 2. derive() → FitReading (simple metrics + verdict copy)
 * 3. deriveClinical() → RiskResult + Suggestions (rolling window analysis)
 */
import { KalmanBank, KalmanTuning } from './kalmanFilter';
import { regionRisk, overallLevel, RegionRisk, LEVELS } from './risk';
import { regionSuggestions, Suggestion } from './geometry';
import { toLogicalWindow, regionIndices } from './channels';
import { PressureFrame, REGIONS, SIDES } from './types';

const SENSOR_COUNT = 18;
const TARGET_HZ = 10.0;
const RISK_WINDOW_FRAMES = 300;

export type FitLevel = 'comfortable' | 'watch' | 'ease-off';

export interface FitReading {
 frame: number[];
 hotIndex: number;
 peak: number;
 average: number;
 comfort: number;
 fitScore: number;
 level: FitLevel;
 accent: string;
 region: string;
 side: string;
 hotLabel: string;
 tag: string;
 headline: string;
 summary: string;
 advice: string;
}

export interface RiskReading {
 available: boolean;
 overallLevel: string;
 regions: RegionRisk[];
 window_s: number;
}

export interface SuggestionReading {
 region: string;
 action: string;
 magnitude: string;
 note: string;
 factors: string[];
 risk_level: string;
}

const COPY: Record<FitLevel, { tag: string; headline: string; summary: string; advice: string }> = {
 comfortable: {
 tag: 'Comfortable',
 headline: 'Your fit looks good',
 summary: 'Pressure is spread evenly and your wear time is on track for today.',
 advice: 'Nothing to change. This spot carries the most load naturally when you walk.',
 },
 watch: {
 tag: 'Keep an eye on it',
 headline: 'One spot to watch',
 summary: 'Everything else is even. We will nudge you if this spot stays high.',
 advice: 'Try shifting your weight or adding a ply. This is the same spot that flagged on Saturday.',
 },
 'ease-off': {
 tag: 'Take a break',
 headline: 'Time for a short break',
 summary: 'Pressure at your limb end is above your usual range. Take the socket off for ten minutes.',
 advice: 'Rest for ten minutes, then add a sock ply. If it still bites, log it for Valerie at Quorum.',
 },
};

function clamp(v: number, lo: number, hi: number): number {
 return Math.max(lo, Math.min(hi, v));
}

export function derive(frame: number[]): FitReading {
 const hotIndex = frame.reduce((best, v, i) => (v > frame[best] ? i : best), 0);
 const peak = frame[hotIndex];
 const average = frame.reduce((a, b) => a + b, 0) / frame.length;

 const comfort = clamp(Math.round(100 - (peak - 55) * 0.7 - Math.max(0, average - 45) * 0.3), 40, 99);
 const fitScore = clamp(Math.round(comfort * 0.6 + 38), 45, 99);

 const level: FitLevel = peak > 100 ? 'ease-off' : peak > 85 ? 'watch' : 'comfortable';
 const region = REGIONS[Math.floor(hotIndex / 3)];
 const side = SIDES[hotIndex % 3];

 return {
 frame,
 hotIndex,
 peak,
 average,
 comfort,
 fitScore,
 level,
 accent: level === 'ease-off' ? '#F54257' : level === 'watch' ? '#F5C842' : '#2EE89E',
 region,
 side,
 hotLabel: `${region} · ${side}`,
 tag: COPY[level].tag,
 headline: COPY[level].headline,
 summary: COPY[level].summary,
 advice: COPY[level].advice,
 };
}

let kalmanBank: KalmanBank | null = null;
let pendingTuning: Partial<KalmanTuning> | null = null;
let pressureBuffer: number[][] = [];

function getKalmanBank(): KalmanBank {
 if (!kalmanBank) {
 kalmanBank = new KalmanBank(SENSOR_COUNT, pendingTuning ?? undefined);
 }
 return kalmanBank;
}

/** Applies Settings' Kalman tuning sliders to the live filter bank (creating
 * it with this tuning if it doesn't exist yet). */
export function setKalmanTuning(tuning: Partial<KalmanTuning>) {
 pendingTuning = tuning;
 if (kalmanBank) kalmanBank.setTuning(tuning);
}

export async function deriveClinical(rawFrame: number[]): Promise<{
 fit: FitReading;
 risk: RiskReading;
 suggestions: SuggestionReading[];
} | null> {
 const trimmed = rawFrame.slice(0, SENSOR_COUNT);
 while (trimmed.length < SENSOR_COUNT) trimmed.push(0);

 const bank = getKalmanBank();
 const { filtered } = bank.update(trimmed);

 pressureBuffer.push([...filtered]);
 while (pressureBuffer.length > RISK_WINDOW_FRAMES) {
 pressureBuffer.shift();
 }

 const fit = derive(filtered);

 let risk: RiskReading;
 try {
 const logical = toLogicalWindow(pressureBuffer);
 const window_s = pressureBuffer.length / TARGET_HZ;
 const regions = regionRisk(logical, TARGET_HZ);
 risk = {
 available: true,
 overallLevel: overallLevel(regions),
 regions,
 window_s: Math.round(window_s * 10) / 10,
 };
 } catch {
 risk = { available: false, overallLevel: 'low', regions: [], window_s: 0 };
 }

 let suggestions: SuggestionReading[] = [];
 try {
 const logical = toLogicalWindow(pressureBuffer);
 const raw = regionSuggestions(logical, TARGET_HZ);
 suggestions = raw.map(s => ({
 region: s.region,
 action: s.action,
 magnitude: s.magnitude,
 note: s.note,
 factors: s.factors,
 risk_level: s.risk_level,
 }));
 } catch {
 suggestions = [];
 }

 return { fit, risk, suggestions };
}

export function resetDerive() {
 kalmanBank = null;
 pressureBuffer = [];
}
