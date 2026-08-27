/**
 * Socket shape suggestions — recommends relieving or adding support in specific
 * anatomical regions based on pressure patterns.
 * Ported from desktop ml/geometry.py.
 */
import { REGIONS } from './types';
import { regionRisk } from './risk';

export type Action = 'relieve' | 'add_support' | 'monitor';
export type Magnitude = 'slight' | 'moderate' | 'significant';

export interface Suggestion {
 region: string;
 action: Action;
 magnitude: Magnitude;
 note: string;
 factors: string[];
 risk_level: string;
}

export function regionSuggestions(logical: number[][], targetHz: number): Suggestion[] {
 const suggestions: Suggestion[] = [];
 const nFrames = logical.length;

 if (nFrames < 10) return suggestions;

 const risks = regionRisk(logical, targetHz);

 for (const risk of risks) {
 if (risk.level === 'low' && risk.mean_kpa > 10) {
 suggestions.push({
 region: risk.region,
 action: 'monitor',
 magnitude: 'slight',
 note: 'Within expected range — keep monitoring.',
 factors: [],
 risk_level: 'low',
 });
 continue;
 }

 if (risk.score > 0 || risk.peak_kpa > 15) {
 const magnitude: Magnitude = risk.score > 15 ? 'significant' : risk.score > 5 ? 'moderate' : 'slight';
 suggestions.push({
 region: risk.region,
 action: 'relieve',
 magnitude,
 note: `Sustained/concentrated pressure in ${risk.region} — consider relieving material here.`,
 factors: risk.factors,
 risk_level: risk.level,
 });
 continue;
 }

 const overallMean = logical.flat().reduce((a, b) => a + b, 0) / (logical.length * 18);
 if (risk.mean_kpa < 15 && overallMean > 20) {
 suggestions.push({
 region: risk.region,
 action: 'add_support',
 magnitude: 'slight',
 note: `${risk.region} carries little load — may indicate a gap (add material here).`,
 factors: [`Mean ${risk.mean_kpa.toFixed(1)} kPa vs socket-wide mean ${overallMean.toFixed(1)} kPa`],
 risk_level: 'low',
 });
 continue;
 }

 suggestions.push({
 region: risk.region,
 action: 'monitor',
 magnitude: 'slight',
 note: 'Within expected range.',
 factors: [],
 risk_level: 'low',
 });
 }

 return suggestions;
}
