/**
 * Web 3D socket viewer for the AVA Fit app using Three.js.
 *
 * Renders the socket mesh with pressure heatmap, sensor spheres,
 * wireframe overlay, and custom orbit controls (drag-to-rotate, wheel-to-zoom).
 * Auto-rotates slowly when idle (resumes after 3 s of no interaction).
 */

import * as THREE from 'three';
import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { pressureColor } from '@/pressure/ramp';
import { PressureFrame } from '@/pressure/types';
import { SOCKET_MESH_B64 } from '@/data/socketMesh';
import { decodePackedMesh } from '@/gl/mesh';

/** Same fallback as SocketViewer.native.tsx: a bundled scan if packed, else a
 * plain cylinder — so the panel never renders as a blank box just because no
 * `mesh` prop was passed (e.g. before fit.tsx's async mesh build resolves). */
function fallbackMesh(): PreparedMeshData {
  try {
    const raw = decodePackedMesh(SOCKET_MESH_B64);
    if (raw.positions.length > 0) {
      return { positions: raw.positions, indices: raw.indices, sensors: new Float32Array(18 * 3), boundingRadius: 65 };
    }
  } catch {}
  const geo = new THREE.CylinderGeometry(40, 40, 100, 24, 6, true);
  const pos = geo.attributes.position.array as Float32Array;
  const idx = geo.index ? Uint32Array.from(geo.index.array) : undefined;
  return { positions: new Float32Array(pos), indices: idx, sensors: new Float32Array(18 * 3), boundingRadius: 65 };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface SocketViewerProps {
 /** Pre-parsed mesh data. If omitted, a minimal placeholder mesh is used. */
 mesh?: PreparedMeshData | null;
 /** 18-element pressure array in kPa. */
 frame?: PressureFrame;
 /** Maximum kPa for the heatmap ramp (default 120). */
 maxKpa?: number;
 /** Show the translucent solid mesh. */
 showMesh?: boolean;
 /** Show sensor spheres on the surface. */
 showSensors?: boolean;
 /** Vertex-color heatmap instead of flat wireframe color. */
 showHeatmap?: boolean;
 /** Show the wireframe overlay. */
 showWireframe?: boolean;
 /** React Native style override. */
 style?: any;
}

/** Subset of PreparedMesh needed by the viewer. */
export interface PreparedMeshData {
 positions: Float32Array;
 indices?: Uint32Array;
 sensors: Float32Array;
 blendRadius?: number;
 boundingRadius: number;
}

// ---------------------------------------------------------------------------
// Visual constants
// ---------------------------------------------------------------------------
const BG = '#0B1220';
const FOV = 50;
const CAMERA_Z = 220;
const AMBIENT_INTENSITY = 0.7;
const DIR_LIGHT_INTENSITY = 0.8;
const DIR_LIGHT_POS = [40, 80, 60] as const;

const SENSOR_RADIUS = 1.8;
const SENSOR_COL = new THREE.Color('#00D4F5');
const HOT_SENSOR_RADIUS = 2.5;
const HOT_SENSOR_COL = new THREE.Color('#F54257');
const WIRE_COL = new THREE.Color('#00D4F5');

const MESH_OPACITY = 0.35;
const WIRE_OPACITY = 0.5;
const AUTO_ROTATE_SPEED = 0.003; // rad/frame
const IDLE_MS = 3000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SocketViewer({
 mesh: meshProp,
 frame = [],
 maxKpa = 120,
 showMesh = true,
 showSensors = true,
 showHeatmap = false,
 showWireframe = true,
 style,
}: SocketViewerProps) {
 const containerRef = useRef<View>(null);
 const canvasRef = useRef<HTMLCanvasElement | null>(null);

 const [dims, setDims] = useState({ w: 0, h: 0 });

 // Guard: does THREE load?
 const threeOk = useMemo(() => {
 try {
 return typeof THREE !== 'undefined' && !!THREE.WebGLRenderer;
 } catch {
 return false;
 }
 }, []);

 // ---------- Decode mesh once ----------
 const decoded = useMemo<PreparedMeshData | null>(() => {
 if (meshProp) return meshProp;
 try { return fallbackMesh(); } catch { return null; }
 }, [meshProp]);

 // ---------- Main effect: scene, lights, render loop ----------
 useEffect(() => {
 if (!threeOk) return;

 // Wait for a measured container size
 if (dims.w <= 0 || dims.h <= 0) return;

 const canvas = canvasRef.current;
 if (!canvas) return;

 // ---- Renderer ----
 const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
 renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
 renderer.setSize(dims.w, dims.h, false);
 renderer.setClearColor(new THREE.Color(BG), 1);

 // ---- Scene ----
 const scene = new THREE.Scene();
 scene.background = new THREE.Color(BG);

 // ---- Camera ----
 const aspect = dims.w / dims.h;
 const camera = new THREE.PerspectiveCamera(FOV, aspect, 1, 2000);
 camera.position.set(0, 0, CAMERA_Z);
 camera.lookAt(0, 0, 0);

 // ---- Lights ----
 scene.add(new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY));
 const dir = new THREE.DirectionalLight(0xffffff, DIR_LIGHT_INTENSITY);
 dir.position.set(...(DIR_LIGHT_POS as [number, number, number]));
 scene.add(dir);

 // ---- Groups ----
 const meshGroup = new THREE.Group();
 scene.add(meshGroup);
 const sensorGroup = new THREE.Group();
 scene.add(sensorGroup);

 // ---- Orbit state (mutable, no re-render) ----
 const orbit = { theta: 0, phi: Math.PI / 2, radius: CAMERA_Z };
 const syncCamera = () => {
 const { theta, phi, radius } = orbit;
 camera.position.set(
 radius * Math.sin(phi) * Math.cos(theta),
 radius * Math.cos(phi),
 radius * Math.sin(phi) * Math.sin(theta),
 );
 camera.lookAt(0, 0, 0);
 };
 syncCamera();

 // ---- Pointer (orbit) controls ----
 let dragging = false;
 let prevX = 0;
 let prevY = 0;

 const onDown = (e: PointerEvent) => {
 dragging = true;
 prevX = e.clientX;
 prevY = e.clientY;
 canvas.setPointerCapture(e.pointerId);
 resetIdle();
 };
 const onMove = (e: PointerEvent) => {
 if (!dragging) return;
 orbit.theta -= (e.clientX - prevX) * 0.005;
 orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, orbit.phi - (e.clientY - prevY) * 0.005));
 prevX = e.clientX;
 prevY = e.clientY;
 resetIdle();
 };
 const onUp = (_e: PointerEvent) => {
 dragging = false;
 startIdle();
 };
 const onWheel = (e: WheelEvent) => {
 e.preventDefault();
 if (e.deltaY > 0) orbit.radius = Math.min(600, orbit.radius * 1.1);
 else orbit.radius = Math.max(80, orbit.radius / 1.1);
 resetIdle();
 };

 canvas.addEventListener('pointerdown', onDown);
 canvas.addEventListener('pointermove', onMove);
 canvas.addEventListener('pointerup', onUp);
 canvas.addEventListener('pointerleave', onUp);
 canvas.addEventListener('wheel', onWheel, { passive: false });

 // ---- Idle / auto-rotate timer ----
 let idleTimer: ReturnType<typeof setTimeout> | null = null;
 let autoRotate = false;

 const startIdle = () => {
 if (idleTimer) clearTimeout(idleTimer);
 autoRotate = false;
 idleTimer = setTimeout(() => { autoRotate = true; }, IDLE_MS);
 };
 const resetIdle = () => {
 if (idleTimer) clearTimeout(idleTimer);
 autoRotate = false;
 idleTimer = setTimeout(() => { autoRotate = true; }, IDLE_MS);
 };
 startIdle();

 // ---- Resize observer ----
 const ro = new ResizeObserver((entries) => {
 for (const entry of entries) {
 const w = entry.contentRect.width;
 const h = entry.contentRect.height;
 if (w <= 0 || h <= 0) return;
 renderer.setSize(w, h, false);
 camera.aspect = w / h;
 camera.updateProjectionMatrix();
 }
 });
 ro.observe(canvas);

 // ---- Build mesh objects ----
 const rebuild = () => {
 // Clear previous
 for (const g of [meshGroup, sensorGroup]) {
 while (g.children.length) {
 const child = g.children[0] as any;
 if (child.geometry) child.geometry.dispose();
 if (child.material) {
 const mats = Array.isArray(child.material) ? child.material : [child.material];
 mats.forEach((m: any) => m.dispose());
 }
 g.remove(child);
 }
 }

 if (!decoded) return;
 const { positions, indices, sensors, blendRadius = 1.5 } = decoded;
 const vCount = positions.length / 3;

 // Compute normals
 const normalsArr = calcNormals(positions, indices);

 // Geometry
 const geo = new THREE.BufferGeometry();
 geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
 geo.setAttribute('normal', new THREE.Float32BufferAttribute(normalsArr, 3));
 if (indices) geo.setIndex(new THREE.Uint32BufferAttribute(indices, 1));

 // Vertex colors (heatmap or wireframe default)
 const colArr = new Float32Array(positions.length);
 for (let i = 0; i < vCount; i++) {
 const px = positions[i * 3];
 const py = positions[i * 3 + 1];
 const pz = positions[i * 3 + 2];
 const pressure = idwPressure(sensors, frame, px, py, pz, blendRadius);

 let r = 0, g = 0.83, b = 0.96; // default wireframe #00D4F5
 if (showHeatmap && frame.length === 18) {
 const rgb = pressureColor(pressure, maxKpa).match(/(\d+),\s*(\d+),\s*(\d+)/);
 if (rgb) { r = +rgb[1] / 255; g = +rgb[2] / 255; b = +rgb[3] / 255; }
 }
 colArr[i * 3] = r;
 colArr[i * 3 + 1] = g;
 colArr[i * 3 + 2] = b;
 }
 geo.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));

 // Solid mesh
 if (showMesh) {
 meshGroup.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
 color: WIRE_COL,
 opacity: MESH_OPACITY,
 transparent: true,
 side: THREE.DoubleSide,
 depthWrite: false,
 })));
 }

 // Wireframe overlay (shares geometry)
 if (showWireframe) {
 const wireGeo = indices ? geo.clone() : geo; // share when indexed
 meshGroup.add(new THREE.Mesh(wireGeo, new THREE.MeshBasicMaterial({
 color: WIRE_COL,
 opacity: WIRE_OPACITY,
 transparent: true,
 wireframe: true,
 depthWrite: false,
 })));
 }

 // Sensor spheres
 if (showSensors && frame.length === 18) {
 let maxP = 0;
 let hotIdx = 0;
 for (let s = 0; s < 18; s++) {
 if (frame[s] > maxP) { maxP = frame[s]; hotIdx = s; }
 }
 const sGeo = new THREE.SphereGeometry(SENSOR_RADIUS, 8, 6);
 const hGeo = new THREE.SphereGeometry(HOT_SENSOR_RADIUS, 8, 6);

 for (let s = 0; s < 18; s++) {
 const isHot = s === hotIdx && maxP > 0;
 const mat = new THREE.MeshPhongMaterial({
 color: isHot ? HOT_SENSOR_COL : SENSOR_COL,
 emissive: isHot ? HOT_SENSOR_COL : SENSOR_COL,
 emissiveIntensity: 0.3,
 });
 const sphere = new THREE.Mesh(isHot ? hGeo : sGeo, mat);
 sphere.position.set(sensors[s * 3], sensors[s * 3 + 1], sensors[s * 3 + 2]);
 sensorGroup.add(sphere);
 }
 }
 };
 rebuild();

 // ---- Render loop ----
 let raf = 0;
 const tick = () => {
 raf = requestAnimationFrame(tick);
 if (autoRotate) {
 orbit.theta += AUTO_ROTATE_SPEED;
 syncCamera();
 }
 renderer.render(scene, camera);
 };
 tick();

 // ---- Cleanup ----
 return () => {
 cancelAnimationFrame(raf);
 if (idleTimer) clearTimeout(idleTimer);
 canvas.removeEventListener('pointerdown', onDown);
 canvas.removeEventListener('pointermove', onMove);
 canvas.removeEventListener('pointerup', onUp);
 canvas.removeEventListener('pointerleave', onUp);
 canvas.removeEventListener('wheel', onWheel);
 ro.disconnect();
 renderer.dispose();
 };
 }, [threeOk, dims.w, dims.h, decoded, showMesh, showSensors, showHeatmap, showWireframe, frame, maxKpa]);

 // ---------- Measure container on mount / when props change ----------
 const measure = useCallback(() => {
 if (containerRef.current) {
 containerRef.current.measure((_x, _y, w, h) => {
 if (w > 0 && h > 0 && (w !== dims.w || h !== dims.h)) setDims({ w, h });
 });
 }
 }, [dims.w, dims.h]);

 useEffect(() => {
 measure();
 }, [measure]);

 // ---------- Placeholder if THREE isn't available ----------
 if (!threeOk) {
 return <View style={[styles.fallback, style]} />;
 }

 return (
 <View
 ref={containerRef}
 style={[styles.container, dims.w > 0 ? { aspectRatio: dims.w / dims.h } : { aspectRatio: 1.4 }, style]}
 collapsable={false}
 >
 <canvas
 ref={canvasRef}
 // This is a literal DOM element (react-native-web doesn't intercept
 // <canvas>'s style prop the way it does for <View>), so it needs a plain
 // CSSProperties object, not RN's StyleSheet.absoluteFill — and
 // `pointerEvents` is a style property here (`pointer-events`), not its own
 // JSX attribute the way it is on RN components.
 style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, pointerEvents: 'auto' }}
 />
 </View>
 );
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/** Face / vertex normals for both indexed and non-indexed geometry. */
function calcNormals(pos: Float32Array, idx?: Uint32Array): Float32Array {
 const out = new Float32Array(pos.length);
 const triCount = idx ? idx.length / 3 : pos.length / 9;

 for (let t = 0; t < triCount; t++) {
 let a = idx ? idx[t * 3] : t * 3;
 let b = idx ? idx[t * 3 + 1] : t * 3 + 1;
 let c = idx ? idx[t * 3 + 2] : t * 3 + 2;

 const ax = pos[a*3], ay = pos[a*3+1], az = pos[a*3+2];
 const bx = pos[b*3], by = pos[b*3+1], bz = pos[b*3+2];
 const cx = pos[c*3], cy = pos[c*3+1], cz = pos[c*3+2];

 const nx = (by-ay)*(cz-az) - (bz-az)*(cy-ay);
 const ny = (bz-az)*(cx-ax) - (bx-ax)*(cz-az);
 const nz = (bx-ax)*(cy-ay) - (by-ay)*(cx-ax);

 for (const vi of [a, b, c]) {
 out[vi*3] += nx;
 out[vi*3+1] += ny;
 out[vi*3+2] += nz;
 }
 }

 for (let i = 0; i < out.length; i += 3) {
 const l = Math.hypot(out[i], out[i+1], out[i+2]) || 1;
 out[i] /= l;
 out[i+1] /= l;
 out[i+2] /= l;
 }
 return out;
}

/**
 * Inverse-distance-squared weighted interpolation of the 18-sensor
 * pressure frame onto an arbitrary (x, y, z) point.
 */
function idwPressure(
 sensors: Float32Array,
 frame: PressureFrame,
 px: number,
 py: number,
 pz: number,
 radius: number,
): number {
 if (frame.length !== 18) return 0;

 let wSum = 0;
 let pSum = 0;
 const rr = radius * radius;

 for (let s = 0; s < 18; s++) {
 const dx = px - sensors[s*3];
 const dy = py - sensors[s*3+1];
 const dz = pz - sensors[s*3+2];
 const d2 = dx*dx + dy*dy + dz*dz;
 if (d2 < 0.0001) return frame[s];
 // Gaussian-like falloff with clamp to avoid extreme weights at very close range
 const w = Math.exp(-d2 / (2 * rr));
 wSum += w;
 pSum += w * frame[s];
 }
 return wSum > 0 ? pSum / wSum : 0;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
 container: {
 backgroundColor: BG,
 borderRadius: 12,
 overflow: 'hidden',
 },
 fallback: {
 backgroundColor: BG,
 borderRadius: 12,
 minHeight: 200,
 justifyContent: 'center',
 alignItems: 'center',
 },
});
