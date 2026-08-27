/**
 * STL and OBJ file parsers for socket 3D models.
 */
export interface RawMesh {
 positions: Float32Array;
 indices?: Uint32Array;
}

export interface PreparedMesh extends RawMesh {
 normals: Float32Array;
 sensors: Float32Array; // 18 xyz triples
 sensorNormals: Float32Array;
 blendRadius: number;
 boundingRadius: number;
 triangleCount: number;
}

function computeNormals(positions: Float32Array, indices?: Uint32Array): Float32Array {
 const normals = new Float32Array(positions.length);
 const v = (i: number) => [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];

 const triCount = indices ? indices.length / 3 : positions.length / 9;

 for (let t = 0; t < triCount; t++) {
 let i0: number, i1: number, i2: number;
 if (indices) {
 i0 = indices[t * 3];
 i1 = indices[t * 3 + 1];
 i2 = indices[t * 3 + 2];
 } else {
 i0 = t * 3;
 i1 = t * 3 + 1;
 i2 = t * 3 + 2;
 }

 const a = v(i0), b = v(i1), c = v(i2);
 const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
 const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
 const nx = uy * vz - uz * vy;
 const ny = uz * vx - ux * vz;
 const nz = ux * vy - uy * vx;

 for (const idx of [i0, i1, i2]) {
 normals[idx * 3] += nx;
 normals[idx * 3 + 1] += ny;
 normals[idx * 3 + 2] += nz;
 }
 }

 for (let i = 0; i < normals.length; i += 3) {
 const len = Math.sqrt(normals[i] ** 2 + normals[i + 1] ** 2 + normals[i + 2] ** 2) || 1;
 normals[i] /= len;
 normals[i + 1] /= len;
 normals[i + 2] /= len;
 }

 return normals;
}

function findClosestVertices(
 positions: Float32Array,
 sensors: { x: number; y: number; z: number }[],
): Float32Array {
 const result = new Float32Array(sensors.length * 3);
 const v = (i: number) => ({ x: positions[i * 3], y: positions[i * 3 + 1], z: positions[i * 3 + 2] });

 for (let s = 0; s < sensors.length; s++) {
 const target = sensors[s];
 let bestDist = Infinity;
 let bestIdx = 0;

 for (let i = 0; i < positions.length / 3; i++) {
 const vert = v(i);
 const dx = vert.x - target.x;
 const dy = vert.y - target.y;
 const dz = vert.z - target.z;
 const dist = dx * dx + dy * dy + dz * dz;
 if (dist < bestDist) {
 bestDist = dist;
 bestIdx = i;
 }
 }

 result[s * 3] = positions[bestIdx * 3];
 result[s * 3 + 1] = positions[bestIdx * 3 + 1];
 result[s * 3 + 2] = positions[bestIdx * 3 + 2];
 }

 return result;
}

function boundingRadius(positions: Float32Array): number {
 let maxR = 0;
 for (let i = 0; i < positions.length; i += 3) {
 const r = Math.sqrt(positions[i] ** 2 + positions[i + 1] ** 2 + positions[i + 2] ** 2);
 if (r > maxR) maxR = r;
 }
 return maxR;
}

export function prepareMesh(mesh: RawMesh, sensorPositions?: { x: number; y: number; z: number }[]): PreparedMesh {
 const positions = mesh.positions;
 const indices = mesh.indices;
 const normals = computeNormals(positions, indices);

 const sensors = sensorPositions || generateDefaultSensors(positions);

 return {
 positions,
 indices,
 normals,
 sensors: findClosestVertices(positions, sensors),
 sensorNormals: new Float32Array(18 * 3),
 blendRadius: 1.5,
 boundingRadius: boundingRadius(positions),
 triangleCount: indices ? indices.length / 3 : positions.length / 9,
 };
}

function generateDefaultSensors(positions: Float32Array): { x: number; y: number; z: number }[] {
 // Auto-place 18 sensors on the mesh surface
 const bounds = getBounds(positions);
 const sensors: { x: number; y: number; z: number }[] = [];

 for (let band = 0; band < 6; band++) {
 const y = bounds.minY + (band / 5) * (bounds.maxY - bounds.minY);
 const radius = bounds.avgRadius * 0.85;

 for (let col = 0; col < 3; col++) {
 const angle = (col / 3) * 2 * Math.PI;
 sensors.push({
 x: Math.cos(angle) * radius,
 y,
 z: Math.sin(angle) * radius,
 });
 }
 }

 return sensors;
}

interface Bounds {
 minY: number;
 maxY: number;
 avgRadius: number;
}

function getBounds(positions: Float32Array): Bounds {
 let minY = Infinity, maxY = -Infinity;
 let rSum = 0, rCount = 0;

 for (let i = 0; i < positions.length; i += 3) {
 const y = positions[i + 1];
 if (y < minY) minY = y;
 if (y > maxY) maxY = y;

 const r = Math.sqrt(positions[i] ** 2 + positions[i + 2] ** 2);
 rSum += r;
 rCount++;
 }

 return { minY, maxY, avgRadius: rSum / rCount };
}

export function parseSTL(buffer: ArrayBuffer): RawMesh {
 const view = new DataView(buffer);
 const positions: number[] = [];
 const indices: number[] = [];

 // STL binary format: 80 byte header, 4 byte triangle count, then 50 bytes per triangle
 const triCount = view.getUint32(80, true);

 for (let t = 0; t < triCount; t++) {
 const offset = 84 + t * 50;
 const base = offset + 12; // skip normal

 for (let v = 0; v < 3; v++) {
 const vOff = base + v * 12;
 positions.push(view.getFloat32(vOff, true));
 positions.push(view.getFloat32(vOff + 4, true));
 positions.push(view.getFloat32(vOff + 8, true));
 }

 const baseIdx = t * 3;
 indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
 }

 return {
 positions: new Float32Array(positions),
 indices: new Uint32Array(indices),
 };
}

export function parseOBJ(text: string): RawMesh {
 const positions: number[] = [];
 const indices: number[] = [];
 const vertexMap = new Map<string, number>();
 let nextIdx = 0;

 for (const line of text.split('\n')) {
 const parts = line.trim().split(/\s+/);
 if (parts[0] === 'v' && parts.length >= 4) {
 positions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
 } else if (parts[0] === 'f' && parts.length >= 4) {
 const faceIndices: number[] = [];
 for (let i = 1; i < parts.length; i++) {
 const key = parts[i];
 let idx = vertexMap.get(key);
 if (idx === undefined) {
 idx = nextIdx++;
 vertexMap.set(key, idx);
 }
 faceIndices.push(idx);
 }
 // Triangulate fan
 for (let i = 1; i < faceIndices.length - 1; i++) {
 indices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
 }
 }
 }

 return {
 positions: new Float32Array(positions),
 indices: new Uint32Array(indices),
 };
}
