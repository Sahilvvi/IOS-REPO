/**
 * Mesh preparation for the 3D socket viewer. Ported from the ava-fit-complete
 * reference build's gl/mesh.ts (PCA-upright orientation, per-cross-section
 * local sensor bands, STL/OBJ parsing) — that version's `prepareMesh()` always
 * auto-places its 18 sensors and has no way to accept externally-computed
 * positions, which would silently break this app's real, wired-up Settings
 * feature (rows/cols/method/coverage/offset via SensorMapper.ts +
 * MeshBuilder.ts). To keep both, this file splits the pipeline into
 * `orientMesh()` (steps 1-3: centre, PCA-upright, open-end-up) and
 * `finishMeshWithSensors()` (snap given sensor targets onto the *oriented*
 * mesh + compute blend/bounding radii) — `prepareMesh()` below is just those
 * two composed with its own auto band-placement for the target step.
 * MeshBuilder.buildPreparedMesh() calls the two-step form directly so
 * SensorMapper's targets are generated against the already-oriented mesh,
 * not the raw scan's arbitrary orientation.
 */
import { SENSOR_COUNT } from '@/pressure/types';

export interface RawMesh {
  positions: Float32Array;
  /** Absent for soup meshes like STL, where every triangle owns its vertices. */
  indices?: Uint16Array | Uint32Array;
}

export interface OrientedMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices?: Uint16Array | Uint32Array;
}

export interface PreparedMesh extends RawMesh {
  normals: Float32Array;
  /** 18 points on the socket wall, xyz interleaved. */
  sensors: Float32Array;
  /** Surface normal at each sensor, so markers can sit just proud of the wall. */
  sensorNormals: Float32Array;
  /** Heatmap blend radius, scaled to the socket so a paediatric and a
   *  transfemoral socket read the same. */
  blendRadius: number;
  /** Radius of the bounding sphere about the origin, for camera framing. */
  boundingRadius: number;
  triangleCount: number;
}

/* ── base64 ─────────────────────────────────────────────────────────────
   Hand-rolled rather than atob(), which is not reliably present on Hermes. */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  const out = new Uint8Array((clean.length * 3) >> 2);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_LOOKUP[clean.charCodeAt(i)];
    const b = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const c = B64_LOOKUP[clean.charCodeAt(i + 2)];
    const d = B64_LOOKUP[clean.charCodeAt(i + 3)];
    out[p++] = (a << 2) | (b >> 4);
    if (i + 2 < clean.length) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (i + 3 < clean.length) out[p++] = ((c & 3) << 6) | d;
  }
  return out;
}

/* ── the bundled socket ─────────────────────────────────────────────────
   Layout: uint32 vertexCount, uint32 triangleCount, float32 origin[3],
           float32 span, uint16 positions[v*3], uint16 indices[t*3] */
export function decodePackedMesh(b64: string): RawMesh {
  const bytes = base64ToBytes(b64);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const vCount = dv.getUint32(0, true);
  const tCount = dv.getUint32(4, true);
  const origin = [dv.getFloat32(8, true), dv.getFloat32(12, true), dv.getFloat32(16, true)];
  const step = dv.getFloat32(20, true) / 65535;

  const positions = new Float32Array(vCount * 3);
  let p = 24;
  for (let i = 0; i < vCount; i++) {
    positions[i * 3] = origin[0] + dv.getUint16(p, true) * step;
    positions[i * 3 + 1] = origin[1] + dv.getUint16(p + 2, true) * step;
    positions[i * 3 + 2] = origin[2] + dv.getUint16(p + 4, true) * step;
    p += 6;
  }
  const indices = new Uint16Array(tCount * 3);
  for (let i = 0; i < indices.length; i++) {
    indices[i] = dv.getUint16(p, true);
    p += 2;
  }
  return { positions, indices };
}

/* ── user-supplied scans ────────────────────────────────────────────────── */
export function parseSTL(buf: ArrayBuffer): RawMesh {
  const dv = new DataView(buf);
  const header = asciiSlice(buf, 0, 5).toLowerCase();
  const looksAscii = header === 'solid' && buf.byteLength < 84 + 50 * dv.getUint32(80, true);

  if (looksAscii) {
    const text = asciiSlice(buf, 0, buf.byteLength);
    const nums: number[] = [];
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) nums.push(+m[1], +m[2], +m[3]);
    return { positions: new Float32Array(nums) };
  }

  const nTri = dv.getUint32(80, true);
  const positions = new Float32Array(nTri * 9);
  for (let i = 0; i < nTri; i++) {
    const o = 84 + i * 50 + 12;
    for (let k = 0; k < 9; k++) positions[i * 9 + k] = dv.getFloat32(o + k * 4, true);
  }
  return { positions };
}

export function parseOBJ(text: string): RawMesh {
  const verts: number[][] = [];
  const positions: number[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('v ')) {
      const p = line.split(/\s+/);
      verts.push([+p[1], +p[2], +p[3]]);
    } else if (line.startsWith('f ')) {
      const idx = line
        .split(/\s+/)
        .slice(1)
        .map(tok => {
          const n = parseInt(tok.split('/')[0], 10);
          return n < 0 ? verts.length + n : n - 1;
        });
      for (let k = 1; k < idx.length - 1; k++) {
        for (const j of [idx[0], idx[k], idx[k + 1]]) {
          const v = verts[j];
          if (v) positions.push(v[0], v[1], v[2]);
        }
      }
    }
  }
  return { positions: new Float32Array(positions) };
}

function asciiSlice(buf: ArrayBuffer, from: number, to: number): string {
  const bytes = new Uint8Array(buf, from, to - from);
  let s = '';
  for (let i = 0; i < bytes.length; i += 4096) {
    s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 4096)));
  }
  return s;
}

/* ── orientation ─────────────────────────────────────────────────────────
 *   1. centre on the centroid — robust to stray far-off triangles
 *   2. stand it upright by principal-component analysis, so scans captured at
 *      an angle (or sockets wider than they are tall) still orient correctly
 *      where a bounding-box guess would not
 *   3. put the wider open end up, keeping the bore off camera
 */
export function orientMesh(raw: RawMesh): OrientedMesh {
  const positions = new Float32Array(raw.positions);
  const count = positions.length / 3;

  // 1 — centre
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < count; i++) {
    cx += positions[i * 3];
    cy += positions[i * 3 + 1];
    cz += positions[i * 3 + 2];
  }
  cx /= count; cy /= count; cz /= count;
  for (let i = 0; i < count; i++) {
    positions[i * 3] -= cx;
    positions[i * 3 + 1] -= cy;
    positions[i * 3 + 2] -= cz;
  }

  // 2 — upright
  applyRotation(positions, rotationBetween(principalAxis(positions), [0, 1, 0]));

  // 3 — open end up
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = positions[i * 3 + 1];
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  let span = Math.max(1e-6, yMax - yMin);
  if (girth(positions, yMin, span, 0, 0.2) > girth(positions, yMin, span, 0.8, 1)) {
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] = -positions[i * 3 + 1];
      positions[i * 3 + 2] = -positions[i * 3 + 2];
    }
  }

  const normals = computeNormals(positions, raw.indices);
  return { positions, normals, indices: raw.indices };
}

/** Bounds of an already-oriented mesh — feed avgRadius/height into
 * SensorMapper.mapSensors() so its targets land in the same frame as
 * `positions` below, not the scan's original (pre-orient) coordinates. */
export function orientedMeshBounds(positions: Float32Array): { minY: number; maxY: number; height: number; avgRadius: number } {
  let minY = Infinity, maxY = -Infinity, rSum = 0, rCount = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    rSum += Math.hypot(positions[i], positions[i + 2]);
    rCount++;
  }
  return { minY, maxY, height: Math.max(1, maxY - minY), avgRadius: rCount ? rSum / rCount : 40 };
}

/** Snap the given 18 sensor target points (already in the oriented mesh's
 * frame — see orientedMeshBounds above) onto the nearest real surface
 * vertices, and compute the remaining PreparedMesh fields. */
export function finishMeshWithSensors(oriented: OrientedMesh, sensorTargets: Float32Array): PreparedMesh {
  const { positions, normals, indices } = oriented;
  const count = positions.length / 3;
  const sensors = new Float32Array(SENSOR_COUNT * 3);
  const sensorNormals = new Float32Array(SENSOR_COUNT * 3);

  for (let s = 0; s < SENSOR_COUNT; s++) {
    const tx = sensorTargets[s * 3], ty = sensorTargets[s * 3 + 1], tz = sensorTargets[s * 3 + 2];
    let best = 0, bestD = Infinity;
    for (let i = 0; i < count; i++) {
      const dx = positions[i * 3] - tx, dy = positions[i * 3 + 1] - ty, dz = positions[i * 3 + 2] - tz;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    sensors[s * 3] = positions[best * 3];
    sensors[s * 3 + 1] = positions[best * 3 + 1];
    sensors[s * 3 + 2] = positions[best * 3 + 2];
    sensorNormals[s * 3] = normals[best * 3];
    sensorNormals[s * 3 + 1] = normals[best * 3 + 1];
    sensorNormals[s * 3 + 2] = normals[best * 3 + 2];
  }

  let boundingRadius = 0;
  for (let i = 0; i < count; i++) {
    const r = Math.hypot(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    if (r > boundingRadius) boundingRadius = r;
  }

  const { avgRadius } = orientedMeshBounds(positions);

  return {
    positions,
    indices,
    normals,
    sensors,
    sensorNormals,
    blendRadius: Math.max(1e-3, avgRadius * 0.36),
    boundingRadius,
    triangleCount: indices ? indices.length / 3 : count / 3,
  };
}

/**
 * Full pipeline for the common case (no externally-computed sensor layout):
 * orient the mesh, then auto-place 18 sensors as six bands up the real axis
 * extent, three points around each band's LOCAL centre and radius — so the
 * array follows the wall of whatever socket is loaded rather than an assumed
 * cylinder.
 */
export function prepareMesh(raw: RawMesh): PreparedMesh {
  const oriented = orientMesh(raw);
  const { positions } = oriented;
  const count = positions.length / 3;
  const { minY: yMin, height: span } = orientedMeshBounds(positions);

  const sensorTargets = new Float32Array(SENSOR_COUNT * 3);
  for (let row = 0; row < 6; row++) {
    const yWant = yMin + (0.14 + 0.72 * (row / 5)) * span;
    const half = span * 0.09;
    let band = collectBand(positions, yWant, half);
    for (let grow = 2; band.length < 12 && grow < 6; grow++) {
      band = collectBand(positions, yWant, half * grow);
    }
    if (!band.length) band = allIndices(count);

    let bx = 0, bz = 0;
    for (const i of band) { bx += positions[i * 3]; bz += positions[i * 3 + 2]; }
    bx /= band.length; bz /= band.length;

    let rSum = 0;
    for (const i of band) rSum += Math.hypot(positions[i * 3] - bx, positions[i * 3 + 2] - bz);
    const rLocal = rSum / band.length;

    for (let col = 0; col < 3; col++) {
      const ang = (-0.62 + 0.62 * col) * Math.PI;
      const s = (row * 3 + col) * 3;
      sensorTargets[s] = bx + rLocal * Math.cos(ang);
      sensorTargets[s + 1] = yWant;
      sensorTargets[s + 2] = bz + rLocal * Math.sin(ang);
    }
  }

  return finishMeshWithSensors(oriented, sensorTargets);
}

function allIndices(count: number): number[] {
  const out: number[] = [];
  const step = Math.max(1, Math.ceil(count / 4000));
  for (let i = 0; i < count; i += step) out.push(i);
  return out;
}

function collectBand(pos: Float32Array, yWant: number, half: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < pos.length / 3; i++) {
    if (Math.abs(pos[i * 3 + 1] - yWant) <= half) out.push(i);
  }
  return out;
}

function girth(pos: Float32Array, yMin: number, span: number, lo: number, hi: number): number {
  let sum = 0, n = 0;
  for (let i = 0; i < pos.length / 3; i++) {
    const t = (pos[i * 3 + 1] - yMin) / span;
    if (t >= lo && t <= hi) {
      sum += Math.hypot(pos[i * 3], pos[i * 3 + 2]);
      n++;
    }
  }
  return n ? sum / n : 0;
}

/** Longest principal axis, by power iteration on the covariance matrix. */
function principalAxis(pos: Float32Array): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const count = pos.length / 3;
  const step = Math.max(1, Math.ceil(count / 8000));
  for (let k = 0; k < count; k += step) {
    const a = [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c[i * 3 + j] += a[i] * a[j];
  }
  let v = [0.31, 0.83, 0.47];
  for (let s = 0; s < 40; s++) {
    const n = [
      c[0] * v[0] + c[1] * v[1] + c[2] * v[2],
      c[3] * v[0] + c[4] * v[1] + c[5] * v[2],
      c[6] * v[0] + c[7] * v[1] + c[8] * v[2],
    ];
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len === 0) break;
    v = [n[0] / len, n[1] / len, n[2] / len];
  }
  return v;
}

/** Rodrigues rotation taking unit vector a onto unit vector b. */
function rotationBetween(a: number[], b: number[]): number[] {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d > 0.999999) return [1, 0, 0, 0, 1, 0, 0, 0, 1];

  let axis = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let len = Math.hypot(axis[0], axis[1], axis[2]);
  if (len < 1e-8) {
    // antiparallel: spin half a turn about any perpendicular
    axis = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    axis = [
      a[1] * axis[2] - a[2] * axis[1],
      a[2] * axis[0] - a[0] * axis[2],
      a[0] * axis[1] - a[1] * axis[0],
    ];
    len = Math.hypot(axis[0], axis[1], axis[2]);
  }
  const [x, y, z] = [axis[0] / len, axis[1] / len, axis[2] / len];
  const cos = Math.max(-1, Math.min(1, d));
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  const t = 1 - cos;
  return [
    t * x * x + cos, t * x * y - sin * z, t * x * z + sin * y,
    t * x * y + sin * z, t * y * y + cos, t * y * z - sin * x,
    t * x * z - sin * y, t * y * z + sin * x, t * z * z + cos,
  ];
}

function applyRotation(pos: Float32Array, m: number[]): void {
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2];
    pos[i] = m[0] * x + m[1] * y + m[2] * z;
    pos[i + 1] = m[3] * x + m[4] * y + m[5] * z;
    pos[i + 2] = m[6] * x + m[7] * y + m[8] * z;
  }
}

/**
 * Area-weighted vertex normals. On the bundled mesh the vertices are welded,
 * so this gives smooth walls — better shading than the flat facet normals an
 * STL carries.
 */
function computeNormals(pos: Float32Array, indices?: Uint16Array | Uint32Array): Float32Array {
  const normals = new Float32Array(pos.length);
  const triCount = indices ? indices.length / 3 : pos.length / 9;

  for (let t = 0; t < triCount; t++) {
    const ia = indices ? indices[t * 3] : t * 3;
    const ib = indices ? indices[t * 3 + 1] : t * 3 + 1;
    const ic = indices ? indices[t * 3 + 2] : t * 3 + 2;

    const ax = pos[ia * 3], ay = pos[ia * 3 + 1], az = pos[ia * 3 + 2];
    const bx = pos[ib * 3], by = pos[ib * 3 + 1], bz = pos[ib * 3 + 2];
    const cx = pos[ic * 3], cy = pos[ic * 3 + 1], cz = pos[ic * 3 + 2];

    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;

    for (const i of [ia, ib, ic]) {
      normals[i * 3] += nx;
      normals[i * 3 + 1] += ny;
      normals[i * 3 + 2] += nz;
    }
  }

  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l;
    normals[i + 1] /= l;
    normals[i + 2] /= l;
  }
  return normals;
}
