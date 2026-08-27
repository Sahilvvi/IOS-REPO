/**
 * Pressure-to-color ramp — shared between 2D grid and 3D heatmap.
 */
import { MAX_KPA } from './types';

const STOPS = [
 { pos: 0.0, r: 0.06, g: 0.17, b: 0.13 },
 { pos: 0.25, r: 0.18, g: 0.63, b: 0.43 },
 { pos: 0.5, r: 0.84, g: 0.75, b: 0.26 },
 { pos: 0.75, r: 0.93, g: 0.55, b: 0.24 },
 { pos: 1.0, r: 0.93, g: 0.24, b: 0.31 },
];

export function pressureColor(kPa: number, maxKpa: number = MAX_KPA): string {
 const t = Math.max(0, Math.min(1, kPa / maxKpa));

 let lower = STOPS[0];
 let upper = STOPS[STOPS.length - 1];
 for (let i = 0; i < STOPS.length - 1; i++) {
 if (t >= STOPS[i].pos && t <= STOPS[i + 1].pos) {
 lower = STOPS[i];
 upper = STOPS[i + 1];
 break;
 }
 }

 const range = upper.pos - lower.pos;
 const f = range > 0 ? (t - lower.pos) / range : 0;
 const r = Math.round((lower.r + (upper.r - lower.r) * f) * 255);
 const g = Math.round((lower.g + (upper.g - lower.g) * f) * 255);
 const b = Math.round((lower.b + (upper.b - lower.b) * f) * 255);

 // Compute luminance to choose ink color
 const lum = 0.299 * r + 0.587 * g + 0.114 * b;
 return `rgb(${r},${g},${b})`;
}

export function pressureColorAlpha(kPa: number, maxKpa: number = MAX_KPA, alpha: number = 1.0): string {
 const t = Math.max(0, Math.min(1, kPa / maxKpa));

 let lower = STOPS[0];
 let upper = STOPS[STOPS.length - 1];
 for (let i = 0; i < STOPS.length - 1; i++) {
 if (t >= STOPS[i].pos && t <= STOPS[i + 1].pos) {
 lower = STOPS[i];
 upper = STOPS[i + 1];
 break;
 }
 }

 const range = upper.pos - lower.pos;
 const f = range > 0 ? (t - lower.pos) / range : 0;
 const r = (lower.r + (upper.r - lower.r) * f).toFixed(3);
 const g = (lower.g + (upper.g - lower.g) * f).toFixed(3);
 const b = (lower.b + (upper.b - lower.b) * f).toFixed(3);

 return `rgba(${Math.round(parseFloat(r) * 255)},${Math.round(parseFloat(g) * 255)},${Math.round(parseFloat(b) * 255)},${alpha})`;
}

export function inkColor(bgColor: string): string {
 const match = bgColor.match(/rgb\((\d+),(\d+),(\d+)\)/);
 if (!match) return '#FFFFFF';
 const [, r, g, b] = match.map(Number);
 const lum = 0.299 * r + 0.587 * g + 0.114 * b;
 return lum > 140 ? '#070A11' : '#FFFFFF';
}
