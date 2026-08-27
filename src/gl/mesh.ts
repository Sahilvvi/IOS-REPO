/**
 * Mesh preparation utilities for the 3D socket viewer.
 * Handles sensor placement, normals computation, and mesh transformations.
 */
export interface RawMesh {
 positions: Float32Array;
 indices?: Uint32Array;
}

export interface PreparedMesh extends RawMesh {
 normals: Float32Array;
 sensors: Float32Array;
 sensorNormals: Float32Array;
 blendRadius: number;
 boundingRadius: number;
 triangleCount: number;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(b64: string): Uint8Array {
 const clean = b64.replace(/=+$/, '');
 const out = new Uint8Array((clean.length * 3) >> 2);
 let p = 0;
 for (let i = 0; i < clean.length; i += 4) {
 const a = B64.indexOf(clean[i]);
 const b = B64.indexOf(clean[i+1]);
 const c = B64.indexOf(clean[i+2]);
 const d = B64.indexOf(clean[i+3]);
 out[p++] = (a << 2) | (b >> 4);
 if (i+2 < clean.length) out[p++] = ((b & 15) << 4) | (c >> 2);
 if (i+3 < clean.length) out[p++] = ((c & 3) << 6) | d;
 }
 return out;
}

export function decodePackedMesh(b64: string): RawMesh {
 const bytes = base64ToBytes(b64);
 const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 const vCount = dv.getUint32(0, true);
 const tCount = dv.getUint32(4, true);
 // Header also carries the original bounding-box origin + span (see
 // tools/packMesh.js) — quantised positions are 0..65535 offsets *within*
 // that box, not world units, so they must be rescaled back out or every
 // packed mesh renders as a unit cube regardless of the scan's real size.
 const lo: [number, number, number] = [dv.getFloat32(8, true), dv.getFloat32(12, true), dv.getFloat32(16, true)];
 const span = dv.getFloat32(20, true);
 const positions = new Float32Array(vCount * 3);

 let p = 24;
 for (let i = 0; i < vCount * 3; i++) {
 const axis = i % 3;
 positions[i] = lo[axis] + (dv.getUint16(p, true) / 65535) * span;
 p += 2;
 }

 // Re-centre on the mesh's own bounding-box centre. The renderer always
 // orbits its camera around world-origin (0,0,0), so an off-centre scan —
 // any real STL, whose origin is wherever the scanner happened to place it —
 // would otherwise sit partly or wholly out of frame.
 const boxLo = [Infinity, Infinity, Infinity], boxHi = [-Infinity, -Infinity, -Infinity];
 for (let i = 0; i < positions.length; i++) {
 const axis = i % 3;
 if (positions[i] < boxLo[axis]) boxLo[axis] = positions[i];
 if (positions[i] > boxHi[axis]) boxHi[axis] = positions[i];
 }
 const center = [0, 1, 2].map((k) => (boxLo[k] + boxHi[k]) / 2);
 for (let i = 0; i < positions.length; i++) positions[i] -= center[i % 3];

 const indices = new Uint32Array(tCount * 3);
 for (let i = 0; i < tCount * 3; i++) {
 indices[i] = dv.getUint16(p, true);
 p += 2;
 }

 return { positions, indices };
}

export function prepareMesh(mesh: RawMesh): PreparedMesh {
 const normals = computeNormals(mesh.positions, mesh.indices);

 // Auto-place 18 sensors on mesh surface
 const sensors = placeSensors(mesh.positions, mesh.indices, normals);

 return {
 positions: mesh.positions,
 indices: mesh.indices,
 normals,
 sensors,
 sensorNormals: new Float32Array(18 * 3),
 // Scale to the mesh's own size — a fixed radius only made sense back when
 // decodePackedMesh returned a normalised 0..1 unit cube (see its fix above).
 blendRadius: computeBlendRadius(mesh.positions),
 boundingRadius: boundingRadius(mesh.positions),
 triangleCount: mesh.indices ? mesh.indices.length / 3 : mesh.positions.length / 9,
 };
}

function computeNormals(positions: Float32Array, indices?: Uint32Array): Float32Array {
 const normals = new Float32Array(positions.length);
 const triCount = indices ? indices.length / 3 : positions.length / 9;

 for (let t = 0; t < triCount; t++) {
 let i0: number, i1: number, i2: number;
 if (indices) {
 i0 = indices[t*3]; i1 = indices[t*3+1]; i2 = indices[t*3+2];
 } else {
 i0 = t*3; i1 = t*3+1; i2 = t*3+2;
 }

 const ax=positions[i0*3], ay=positions[i0*3+1], az=positions[i0*3+2];
 const bx=positions[i1*3], by=positions[i1*3+1], bz=positions[i1*3+2];
 const cx=positions[i2*3], cy=positions[i2*3+1], cz=positions[i2*3+2];

 const ux=bx-ax, uy=by-ay, uz=bz-az;
 const vx=cx-ax, vy=cy-ay, vz=cz-az;
 const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;

 for (const idx of [i0,i1,i2]) {
 normals[idx*3]+=nx; normals[idx*3+1]+=ny; normals[idx*3+2]+=nz;
 }
 }

 for (let i=0;i<normals.length;i+=3) {
 const len=Math.sqrt(normals[i]**2+normals[i+1]**2+normals[i+2]**2)||1;
 normals[i]/=len; normals[i+1]/=len; normals[i+2]/=len;
 }
 return normals;
}

function placeSensors(positions: Float32Array, indices?: Uint32Array, normals?: Float32Array): Float32Array {
 const bounds = getBounds(positions);
 const result = new Float32Array(18 * 3);

 for (let band = 0; band < 6; band++) {
 const t = band / 5;
 const y = bounds.minY + t * (bounds.maxY - bounds.minY);
 const radius = bounds.avgRadius * (0.8 + t * 0.1);

 for (let col = 0; col < 3; col++) {
 const angle = Math.PI / 2 + col * (2 * Math.PI / 3);
 const tx = Math.cos(angle) * radius;
 const tz = Math.sin(angle) * radius;
 const ty = y;

 // Find closest vertex on mesh
 let bestDist = Infinity, bestIdx = 0;
 for (let v = 0; v < positions.length / 3; v++) {
 const dx = positions[v*3]-tx, dy = positions[v*3+1]-ty, dz = positions[v*3+2]-tz;
 const d = dx*dx+dy*dy+dz*dz;
 if (d < bestDist) { bestDist = d; bestIdx = v; }
 }

 const si = (band * 3 + col) * 3;
 result[si] = positions[bestIdx*3];
 result[si+1] = positions[bestIdx*3+1];
 result[si+2] = positions[bestIdx*3+2];
 }
 }

 return result;
}

function boundingRadius(positions: Float32Array): number {
 let maxR = 0;
 for (let i = 0; i < positions.length; i += 3) {
 const r = Math.sqrt(positions[i]**2 + positions[i+1]**2 + positions[i+2]**2);
 if (r > maxR) maxR = r;
 }
 return maxR;
}

interface Bounds {
 minY: number;
 maxY: number;
 avgRadius: number;
}

function getBounds(positions: Float32Array): Bounds {
 let minY=Infinity, maxY=-Infinity;
 let rSum=0, rCount=0;

 for (let i=0;i<positions.length;i+=3) {
 const y=positions[i+1];
 if (y<minY) minY=y;
 if (y>maxY) maxY=y;
 const r=Math.sqrt(positions[i]**2+positions[i+2]**2);
 rSum+=r; rCount++;
 }

 return { minY, maxY, avgRadius: rSum/rCount };
}

export function computeBlendRadius(positions: Float32Array): number {
 return boundingRadius(positions) * 0.04;
}
