/**
 * 18-channel Kalman filter bank.
 * Ported from desktop backend/kalman_filter.py.
 */
import { SENSOR_COUNT } from './types';

export interface KalmanTuning {
 qTrue: number;
 qDriftActive: number;
 qDriftIdle: number;
 rMeas: number;
 driftThreshold: number;
 driftEngageN: number;
}

export interface KalmanStatus {
 globalEnabled: boolean;
 nCells: number;
 driftEngagedCount: number;
 tuning: KalmanTuning;
}

const DEFAULT_Q_TRUE = 0.08;
const DEFAULT_Q_DRIFT_ACTIVE = 0.15;
const DEFAULT_Q_DRIFT_IDLE = 0.02;
const DEFAULT_R_MEAS = 0.4;
const DEFAULT_DRIFT_THRESHOLD = 2.0;
const DEFAULT_DRIFT_ENGAGE_N = 20;

interface CellState {
 x: number;
 p: number;
 drift: number;
 driftP: number;
 driftEngageCount: number;
 driftEngaged: boolean;
}

export class KalmanBank {
 private cells: CellState[];
 private _globalEnabled = true;
 public tuning: KalmanTuning;

 constructor(nCells: number, tuning?: Partial<KalmanTuning>) {
 this.cells = Array.from({ length: nCells }, () => ({
 x: 0, p: 1.0, drift: 0, driftP: 1.0, driftEngageCount: 0, driftEngaged: false,
 }));
 this.tuning = {
 qTrue: tuning?.qTrue ?? DEFAULT_Q_TRUE,
 qDriftActive: tuning?.qDriftActive ?? DEFAULT_Q_DRIFT_ACTIVE,
 qDriftIdle: tuning?.qDriftIdle ?? DEFAULT_Q_DRIFT_IDLE,
 rMeas: tuning?.rMeas ?? DEFAULT_R_MEAS,
 driftThreshold: tuning?.driftThreshold ?? DEFAULT_DRIFT_THRESHOLD,
 driftEngageN: tuning?.driftEngageN ?? DEFAULT_DRIFT_ENGAGE_N,
 };
 }

 get globalEnabled(): boolean { return this._globalEnabled; }
 set globalEnabled(v: boolean) { this._globalEnabled = v; }

 reset() {
 for (const c of this.cells) {
 c.x = 0; c.p = 1.0; c.drift = 0; c.driftP = 1.0;
 c.driftEngageCount = 0; c.driftEngaged = false;
 }
 }

 update(raw: number[]): { filtered: number[]; drift: number[]; driftEngaged: boolean[] } {
 const n = this.cells.length;
 const filtered = new Array(n);
 const drift = new Array(n);
 const driftEngaged = new Array(n);
 const t = this.tuning;

 for (let i = 0; i < n; i++) {
 const c = this.cells[i];
 const z = raw[i] ?? 0;

 if (!this._globalEnabled) {
 filtered[i] = z;
 drift[i] = 0;
 driftEngaged[i] = false;
 continue;
 }

 const innovation = Math.abs(z - (c.x + c.drift));
 if (innovation > t.driftThreshold) {
 c.driftEngageCount = Math.min(c.driftEngageCount + 1, t.driftEngageN + 1);
 } else {
 c.driftEngageCount = Math.max(c.driftEngageCount - 1, 0);
 }
 c.driftEngaged = c.driftEngageCount >= t.driftEngageN;
 const qDrift = c.driftEngaged ? t.qDriftActive : t.qDriftIdle;

 c.x += c.drift;
 c.p += qDrift;
 c.driftP += 0.01;

 const k = c.p / (c.p + t.rMeas);
 c.x += k * (z - c.x);
 c.p *= 1 - k;

 const residual = z - c.x;
 c.drift += k * residual * 0.3;
 c.driftP *= 0.95;

 c.p = Math.max(c.p, 0.01);
 c.driftP = Math.max(c.driftP, 0.01);

 filtered[i] = c.x;
 drift[i] = c.drift;
 driftEngaged[i] = c.driftEngaged;
 }

 return { filtered, drift, driftEngaged };
 }

 setTuning(data: Partial<KalmanTuning>) {
 Object.assign(this.tuning, data);
 }

 getTuning(): KalmanTuning {
 return { ...this.tuning };
 }

 status(): KalmanStatus {
 return {
 globalEnabled: this._globalEnabled,
 nCells: this.cells.length,
 driftEngagedCount: this.cells.filter(c => c.driftEngaged).length,
 tuning: this.getTuning(),
 };
 }
}
