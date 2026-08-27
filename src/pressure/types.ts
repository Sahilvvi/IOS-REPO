/**
 * 18 sensors: 6 bands up the socket, 3 points around each band.
 * Band 0 = Front of knee (proximal), Band 5 = Back of calf (distal).
 *
 * Raw BLE order may not match this — the firmware sends in a fixed order
 * that differs from the physical layout. See channels.ts for permutation.
 */
export const SENSOR_COUNT = 18;
export const MAX_KPA = 120;

export const REGIONS = [
 'Front of knee',
 'Upper front',
 'Mid shin',
 'Lower shin',
 'Limb end',
 'Back of calf',
] as const;

export const SIDES = ['inner edge', 'centre', 'outer edge'] as const;

export const BASELINE_KPA: number[] = [
 34, 40, 36,
 52, 66, 55,
 68, 96, 72,
 60, 78, 64,
 44, 54, 47,
 33, 39, 36,
];

export type PressureFrame = number[];

export interface PressureSource {
 readonly id: string;
 subscribe(onFrame: (frame: PressureFrame) => void): () => void;
}
