/**
 * Pressure-injury risk screening — literature-informed heuristic, not a diagnosis.
 * Ported from desktop ml/risk.py.
 *
 * Expects `logical` (in every function below) to already be in anatomical
 * channel order — callers must run the raw pressure window through
 * `toLogicalWindow()` (channels.ts) first.
 */

export const LEVELS = ['low', 'moderate', 'high', 'critical'] as const;
export type RiskLevel = typeof LEVELS[number];

const LEVEL_ORDER: Record<RiskLevel, number> = { low: 0, moderate: 1, high: 2, critical: 3 };

const OCCLUSION_KPA = 4.3;
const CONCENTRATION_KPA = 30.0;
const RELIEF_FRACTION = 0.5;
const PTI_THRESHOLD_KPA_S = 8.0;
const GINI_HIGH = 0.55;

export interface RegionRisk {
 region: string;
 level: RiskLevel;
 score: number;
 peak_kpa: number;
 mean_kpa: number;
 pti: number;
 no_relief_s: number;
 concentration: number;
 factors: string[];
}

export interface RiskResult {
 available: boolean;
 overallLevel: RiskLevel;
 regions: RegionRisk[];
 window_s: number;
}

const REGIONS = [
 'Front of knee',
 'Upper front',
 'Mid shin',
 'Lower shin',
 'Limb end',
 'Back of calf',
];

function gini(values: number[]): number {
 const n = values.length;
 if (n === 0) return 0;
 const sorted = [...values].sort((a, b) => a - b);
 const total = sorted.reduce((a, b) => a + b, 0);
 if (total <= 1e-6) return 0;
 let sumDiffs = 0;
 for (let i = 0; i < n; i++) {
 sumDiffs += (2 * (i + 1) - n - 1) * sorted[i];
 }
 return sumDiffs / (n * total);
}

function noReliefDuration(logical: number[][], regionIndices: number[]): number {
 if (logical.length < 2) return 0;
 const peaks: number[] = [];
 for (const row of logical) {
 let peak = 0;
 for (const idx of regionIndices) peak = Math.max(peak, row[idx] ?? 0);
 peaks.push(peak);
 }
 const windowSize = Math.min(peaks.length, 60);
 const recentPeak = Math.max(...peaks.slice(-windowSize));
 if (recentPeak < 1.0) return 0;
 const threshold = recentPeak * RELIEF_FRACTION;
 let noReliefFrames = 0;
 let maxNoRelief = 0;
 for (let i = peaks.length - 1; i >= 0; i--) {
 if (peaks[i] >= threshold) {
 maxNoRelief = Math.max(maxNoRelief, noReliefFrames);
 break;
 }
 noReliefFrames++;
 if (i === 0) maxNoRelief = Math.max(maxNoRelief, noReliefFrames);
 }
 return maxNoRelief * 0.1;
}

export function regionRisk(logical: number[][], targetHz: number): RegionRisk[] {
 const nFrames = logical.length;
 if (nFrames === 0) return [];

 const dt = 1 / targetHz;
 const results: RegionRisk[] = [];

 for (let r = 0; r < REGIONS.length; r++) {
 const regionIndices = [r * 3, r * 3 + 1, r * 3 + 2];
 const vals: number[] = [];
 const means: number[] = [];

 for (const row of logical) {
 let peak = 0, sum = 0;
 for (const idx of regionIndices) {
 const v = row[idx] ?? 0;
 sum += v;
 peak = Math.max(peak, v);
 }
 vals.push(peak);
 means.push(sum / regionIndices.length);
 }

 const peak_kpa = Math.max(...vals);
 const mean_kpa = means.reduce((a, b) => a + b, 0) / means.length;
 const pti = vals.reduce((a, v) => a + v * dt, 0);
 const concentration = gini(vals);
 const noReliefS = noReliefDuration(logical, regionIndices);

 const factors: string[] = [];
 let level: RiskLevel = 'low';

 if (pti > PTI_THRESHOLD_KPA_S * 2) {
 factors.push(`Sustained load (PTI ${pti.toFixed(1)} kPa·s)`);
 level = 'high';
 } else if (pti > PTI_THRESHOLD_KPA_S) {
 factors.push(`Elevated pressure-time integral (${pti.toFixed(1)} kPa·s)`);
 level = 'moderate';
 }

 if (peak_kpa > 60) {
 factors.push(`High peak pressure (${peak_kpa.toFixed(0)} kPa)`);
 if (LEVEL_ORDER['critical'] > LEVEL_ORDER[level]) level = 'critical';
 } else if (peak_kpa > CONCENTRATION_KPA) {
 factors.push(`Peak pressure ${peak_kpa.toFixed(0)} kPa`);
 if (LEVEL_ORDER['high'] > LEVEL_ORDER[level]) level = 'high';
 }

 if (concentration > 0.7 && peak_kpa > 15) {
 factors.push('Concentrated load on one sensor');
 if (LEVEL_ORDER['high'] > LEVEL_ORDER[level]) level = 'high';
 } else if (concentration > GINI_HIGH && peak_kpa > 15) {
 factors.push('Moderately concentrated load');
 if (LEVEL_ORDER['moderate'] > LEVEL_ORDER[level]) level = 'moderate';
 }

 if (noReliefS > 120) {
 factors.push(`No relief for ${noReliefS.toFixed(0)}s`);
 if (LEVEL_ORDER['critical'] > LEVEL_ORDER[level]) level = 'critical';
 } else if (noReliefS > 60) {
 factors.push(`No relief for ${noReliefS.toFixed(0)}s`);
 if (LEVEL_ORDER['high'] > LEVEL_ORDER[level]) level = 'high';
 } else if (noReliefS > 30) {
 factors.push(`No relief for ${noReliefS.toFixed(0)}s`);
 if (LEVEL_ORDER['moderate'] > LEVEL_ORDER[level]) level = 'moderate';
 }

 if (mean_kpa > OCCLUSION_KPA && noReliefS > 15) {
 factors.push('Sustained near-occlusive pressure');
 if (LEVEL_ORDER['moderate'] > LEVEL_ORDER[level]) level = 'moderate';
 }

 results.push({
 region: REGIONS[r],
 level,
 score: pti,
 peak_kpa,
 mean_kpa,
 pti,
 no_relief_s: noReliefS,
 concentration,
 factors,
 });
 }

 return results;
}

export function overallLevel(regions: RegionRisk[]): RiskLevel {
 if (regions.length === 0) return 'low';
 return regions.reduce<RiskLevel>((worst, r) =>
 LEVEL_ORDER[r.level] > LEVEL_ORDER[worst] ? r.level : worst
 , 'low');
}
