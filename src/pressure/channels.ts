/**
 * BLE-to-anatomical channel permutation.
 *
 * The 18 values coming from the ESP32-S3 firmware are in the order the
 * firmware writes them, which is a PERMUTATION of the physical layout.
 * This file provides a single place to reorder them into logical order
 * so the rest of the app can rely on spatial consistency.
 *
 * EMISSION_ORDER is the order the firmware writes:
 * m1_r0c0, m1_r0c1, m1_r0c2, m1_r1c0, ... m1_r2c2, m2_r0c0, ...
 *
 * To fix a wiring permutation, set PERMUTATION[i] = index in the
 * incoming BLE frame that actually belongs at logical position i.
 */

import { SENSOR_COUNT } from './types';

export const N_SENSORS = SENSOR_COUNT;
export const N_PADS = 2;
export const PAD_ROWS = 3;
export const PAD_COLS = 3;
export const PAD_NAMES = ['anterior', 'posterior'] as const;

export const REGION_ROWS = { proximal: 0, mid: 1, distal: 2 } as const;

export const EMISSION_ORDER: string[] = [];
for (let pad = 0; pad < N_PADS; pad++) {
 for (let r = 0; r < PAD_ROWS; r++) {
 for (let c = 0; c < PAD_COLS; c++) {
 EMISSION_ORDER.push(`m${pad + 1}_r${r}c${c}`);
 }
 }
}

// Identity permutation — override in storage when wiring is verified
const IDENTITY = Array.from({ length: N_SENSORS }, (_, i) => i);

export function loadPermutation(): number[] {
 return IDENTITY;
}

export function savePermutation(_perm: number[]): void {
 // TODO: persist to SecureStore once wiring is verified
}

export function isIdentity(perm: number[] = loadPermutation()): boolean {
 return perm.length === N_SENSORS && perm.every((v, i) => v === i);
}

export function toLogical(raw: number[], perm: number[] = loadPermutation()): number[] {
 const out = new Array(N_SENSORS);
 for (let i = 0; i < N_SENSORS; i++) {
 out[i] = raw[perm[i]] ?? 0;
 }
 return out;
}

/**
 * Same permutation, applied per-frame across a rolling window of frames.
 * risk.ts/geometry.ts operate on a `number[][]` window (frames x channels),
 * not a single frame — calling `toLogical` directly on a window would index
 * frames as if they were channel values. Use this instead whenever the input
 * is a buffer of frames, not one frame.
 */
export function toLogicalWindow(rawWindow: number[][], perm: number[] = loadPermutation()): number[][] {
 return rawWindow.map((frame) => toLogical(frame, perm));
}

export function toGrid(logical: number[]): number[][][] {
 // Shape: [2 pads][3 rows][3 cols]
 const grid: number[][][] = [];
 for (let pad = 0; pad < N_PADS; pad++) {
 const padArr: number[][] = [];
 for (let r = 0; r < PAD_ROWS; r++) {
 const rowArr: number[] = [];
 for (let c = 0; c < PAD_COLS; c++) {
 const idx = pad * 9 + r * 3 + c;
 rowArr.push(logical[idx] ?? 0);
 }
 padArr.push(rowArr);
 }
 grid.push(padArr);
 }
 return grid;
}

export function toRenderGrid(logical: number[]): number[][] {
 // 3x6 grid for display: anterior cols 0-2, posterior cols 3-5
 const grid: number[][] = Array.from({ length: 3 }, () => Array(6).fill(0));
 for (let r = 0; r < 3; r++) {
 for (let c = 0; c < 3; c++) {
 grid[r][c] = logical[0 * 9 + r * 3 + c] ?? 0; // anterior
 grid[r][c + 3] = logical[1 * 9 + r * 3 + c] ?? 0; // posterior
 }
 }
 return grid;
}

export function regionIndices(region: keyof typeof REGION_ROWS, pad?: number): number[] {
 const row = REGION_ROWS[region];
 const pads = pad !== undefined ? [pad] : [0, 1];
 const indices: number[] = [];
 for (const p of pads) {
 for (let c = 0; c < PAD_COLS; c++) {
 indices.push(p * 9 + row * PAD_COLS + c);
 }
 }
 return indices;
}

export function padIndices(pad: number): number[] {
 return Array.from({ length: 9 }, (_, i) => pad * 9 + i);
}

export function describe(index: number): string {
 const pad = Math.floor(index / 9);
 const rem = index % 9;
 const row = Math.floor(rem / 3);
 const col = rem % 3;
 const band = Object.entries(REGION_ROWS).find(([, v]) => v === row)?.[0] ?? '?';
 return `${PAD_NAMES[pad]} ${band} c${col}`;
}
