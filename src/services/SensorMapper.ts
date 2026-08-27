/**
 * Sensor placement algorithms for mapping 18 sensors onto a socket mesh.
 * Ported from desktop SensorMapper.ts concepts.
 */
export type MappingMethod = 'cylindrical' | 'conformal' | 'geodesic';

export interface SensorPlacement {
 x: number;
 y: number;
 z: number;
}

export interface MappingResult {
 sensors: SensorPlacement[];
 coverage: number;
}

/**
 * Cylindrical mapping — place sensors in even bands around a cylinder.
 */
export function cylindricalMap(
 rows: number,
 cols: number,
 coverage: number = 0.85,
 offset: number = 2.0,
 _radius: number = 40,
 _height: number = 100,
): MappingResult {
 const sensors: SensorPlacement[] = [];
 const bandSpacing = (_height - offset * 2) / Math.max(rows - 1, 1);

 for (let r = 0; r < rows; r++) {
 const y = offset + r * bandSpacing - _height / 2;
 const angleStep = (2 * Math.PI) / cols;
 const startAngle = Math.PI / 2;

 for (let c = 0; c < cols; c++) {
 const angle = startAngle + c * angleStep;
 const x = Math.cos(angle) * _radius * coverage;
 const z = Math.sin(angle) * _radius * coverage;
 sensors.push({ x, y, z });
 }
 }

 return { sensors, coverage };
}

/**
 * Conformal mapping — sensors follow the socket surface more closely.
 * Simplified: same as cylindrical but with radius variation per band.
 */
export function conformalMap(
 rows: number,
 cols: number,
 coverage: number = 0.85,
 offset: number = 2.0,
 _radius: number = 40,
 _height: number = 100,
): MappingResult {
 const sensors: SensorPlacement[] = [];
 const bandSpacing = (_height - offset * 2) / Math.max(rows - 1, 1);

 for (let r = 0; r < rows; r++) {
 const y = offset + r * bandSpacing - _height / 2;
 // Radius varies: wider at proximal, narrower at distal
 const radiusVar = _radius * coverage * (1.0 - r * 0.03);
 const angleStep = (2 * Math.PI) / cols;
 const startAngle = Math.PI / 2;

 for (let c = 0; c < cols; c++) {
 const angle = startAngle + c * angleStep;
 const x = Math.cos(angle) * radiusVar;
 const z = Math.sin(angle) * radiusVar;
 sensors.push({ x, y, z });
 }
 }

 return { sensors, coverage };
}

/**
 * Geodesic mapping — places sensors along geodesic paths on the surface.
 * Simplified: same as cylindrical but with angular offset per band.
 */
export function geodesicMap(
 rows: number,
 cols: number,
 coverage: number = 0.85,
 offset: number = 2.0,
 _radius: number = 40,
 _height: number = 100,
): MappingResult {
 const sensors: SensorPlacement[] = [];
 const bandSpacing = (_height - offset * 2) / Math.max(rows - 1, 1);

 for (let r = 0; r < rows; r++) {
 const y = offset + r * bandSpacing - _height / 2;
 const angleStep = (2 * Math.PI) / cols;
 const startAngle = Math.PI / 2 + r * 0.15;

 for (let c = 0; c < cols; c++) {
 const angle = startAngle + c * angleStep;
 const x = Math.cos(angle) * _radius * coverage;
 const z = Math.sin(angle) * _radius * coverage;
 sensors.push({ x, y, z });
 }
 }

 return { sensors, coverage };
}

export function mapSensors(
 method: MappingMethod,
 rows: number,
 cols: number,
 coverage: number = 0.85,
 offset: number = 2.0,
 radius: number = 40,
 height: number = 100,
): MappingResult {
 switch (method) {
 case 'conformal':
 return conformalMap(rows, cols, coverage, offset, radius, height);
 case 'geodesic':
 return geodesicMap(rows, cols, coverage, offset, radius, height);
 default:
 return cylindricalMap(rows, cols, coverage, offset, radius, height);
 }
}
