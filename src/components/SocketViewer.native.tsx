/**
 * SocketViewer.native.tsx — ES 2.0 renderer (no deprecated fixed-fn calls).
 */

import React, { useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { pressureColor } from '@/pressure/ramp';
import { BASELINE_KPA, SENSOR_COUNT } from '@/pressure/types';

// `expo-gl`'s GLView touches its native module the instant this module is
// evaluated (requireNativeModule throws synchronously if it isn't linked in
// this particular build) — and because Expo Router eagerly requires every
// route on native, that happens at app launch, not when the Fit tab is
// opened. A guarded lazy require turns a missing/broken native module into a
// graceful fallback panel instead of an instant, uncatchable app crash.
let GLView: any = null;
try {
  GLView = require('expo-gl').GLView;
} catch (e) {
  console.warn('[SocketViewer] expo-gl unavailable — 3D view disabled:', e);
}

// -------- shader sources --------

const VERT = `
attribute vec3 aPos;
attribute vec3 aCol;
uniform mat4 uMVP;
varying lowp vec3 vCol;
void main(){
 gl_Position = uMVP * vec4(aPos,1.0);
 vCol = aCol;
}
`;

const FRAG = `
precision mediump float;
varying lowp vec3 vCol;
void main(){
 gl_FragColor = vec4(vCol,1.0);
}
`;

// -------- helpers --------

function compileShader(gl: any, type: number, src: string) {
 const s = gl.createShader(type);
 gl.shaderSource(s, src);
 gl.compileShader(s);
 if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); }
 return s;
}

function link(gl: any, vs: any, fs: any) {
 const p = gl.createProgram();
 gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
 if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { throw new Error(gl.getProgramInfoLog(p)); }
 return p;
}

function cssGL(str: string): [number, number, number] {
 const m = str.match(/[\d.]+/g);
 if (!m || m.length < 3) return [1,1,1];
 const n = m.map(Number);
 return n[0] > 1 ? [n[0]/255, n[1]/255, n[2]/255] : [n[0], n[1], n[2]];
}

function cylinder(r: number, h: number, s: number) {
 const hh = h/2, vc = (s+1)*2+2;
 const p = new Float32Array(vc*3), ix: number[] = [];
 for (let i = 0; i <= s; i++) {
 const a = (i/s)*Math.PI*2, c = Math.cos(a), sn = Math.sin(a);
 const t0=i*2, t1=i*2+1;
 p[t0*3]=c*r; p[t0*3+1]=hh; p[t0*3+2]=sn*r;
 p[t1*3]=c*r; p[t1*3+1]=-hh; p[t1*3+2]=sn*r;
 }
 const tc = (s+1)*2; p[tc*3]=0; p[tc*3+1]=hh; p[tc*3+2]=0; p[tc+1]=(tc+1)*3; p[tc+1*3]=0; p[tc+1*3+1]=-hh; p[tc+1*3+2]=0;
 for (let i = 0; i < s; i++) { const a=i*2,b=a+1,c2=a+2,d=c2+1; ix.push(a,b,c2,c2,b,d); }
 for (let i = 0; i < s; i++) ix.push(tc,i*2,((i+1)%(s+1))*2);
 for (let i = 0; i < s; i++) ix.push(tc+1,((i+1)%(s+1))*2+1,i*2+1);
 return { positions: p, indices: Uint16Array.from(ix) };
}

function sphere(r: number, la: number, lo: number) {
 const vc = (la+1)*(lo+1);
 const p = new Float32Array(vc*3), ix: number[] = [];
 for (let j = 0; j <= la; j++) {
 const th = (j/la)*Math.PI, st = Math.sin(th), ct = Math.cos(th);
 for (let i = 0; i <= lo; i++) {
 const ph = (i/lo)*Math.PI*2, cp = Math.cos(ph), sp = Math.sin(ph);
 const vi = (j*(lo+1)+i)*3;
 p[vi]=r*cp*st; p[vi+1]=r*ct; p[vi+2]=r*sp*st;
 }
 }
 for (let j = 0; j < la; j++)
 for (let i = 0; i < lo; i++) { const a=j*(lo+1)+i,b=a+lo+1; ix.push(a,b,a+1,b,b+1,a+1); }
 return { positions: p, indices: Uint16Array.from(ix) };
}

function mat4Perspective(fov: number, asp: number, n: number, f: number) {
 const t = 1/Math.tan(fov/2), nf = 1/(n-f), o = new Float32Array(16);
 o[0]=t/asp; o[5]=t; o[10]=(f+n)*nf; o[11]=-1; o[14]=2*f*n*nf;
 return o;
}

function mat4LookAt(eye: number[], c: number[], up: number[]) {
 let fx=eye[0]-c[0], fy=eye[1]-c[1], fz=eye[2]-c[2];
 let l=1/Math.sqrt(fx*fx+fy*fy+fz*fz); fx*=l; fy*=l; fz*=l;
 let rx=up[1]*fz-up[2]*fy, ry=up[2]*fx-up[0]*fz, rz=up[0]*fy-up[1]*fx;
 l=1/Math.sqrt(rx*rx+ry*ry+rz*rz); rx*=l; ry*=l; rz*=l;
 const ux=fy*rz-fz*ry, uy=fz*rx-fx*rz, uz=fx*ry-fy*rx;
 const o = new Float32Array(16);
 o[0]=rx; o[1]=ux; o[2]=fx; o[3]=0;
 o[4]=ry; o[5]=uy; o[6]=fy; o[7]=0;
 o[8]=rz; o[9]=uz; o[10]=fz; o[11]=0;
 o[12]=-(rx*eye[0]+ry*eye[1]+rz*eye[2]);
 o[13]=-(ux*eye[0]+uy*eye[1]+uz*eye[2]);
 o[14]=-(fx*eye[0]+fy*eye[1]+fz*eye[2]);
 o[15]=1;
 return o;
}

function mulMVP(proj: Float32Array, view: Float32Array): Float32Array {
 const o = new Float32Array(16);
 for (let r = 0; r < 4; r++)
 for (let c = 0; c < 4; c++)
 o[r*4+c] = proj[r*4]*view[c*4]+proj[r*4+1]*view[c*4+4]+proj[r*4+2]*view[c*4+8]+proj[r*4+3]*view[c*4+12];
 return o;
}

// -------- component --------

export default function SocketViewer({ height = 220, ...props }: any) {
 const glR = useRef<any>(null);
 const rafR = useRef(0);
 const thR = useRef(0.4), phR = useRef(0.3), dR = useRef(220);
 // Zoom clamp range, rescaled per-mesh below — a real STL scan can be a
 // wildly different physical scale from the procedural fallback cylinder.
 const zoomR = useRef({ min: 60, max: 600 });
 const touchR = useRef<{x:number;y:number}|null>(null);
 const pinchR = useRef(0);
 const moveR = useRef(Date.now());
 const autoR = useRef(true);
 const frame = props.frame || [];
 const maxKpa = props.maxKpa || 120;

 const mesh = useMemo(() => {
 try {
 let raw = props.mesh;
 if (!raw) {
 try { const m = require('@/data/socketMesh'); if (m?.SOCKET_MESH_B64?.length) raw = m.decodePackedMesh(m.SOCKET_MESH_B64); } catch {}
 }
 if (!raw?.positions?.length) raw = cylinder(40, 100, 24);
 if (props.onMeshReady) props.onMeshReady(raw);
 return raw;
 } catch (e) { console.warn('[SocketViewer] mesh error:', e); return null; }
 }, [props.mesh]);

 // Frame the camera to whatever scale this mesh actually is — a bundled real
 // scan runs ~150-200 world units in radius, the procedural fallback ~65.
 // A fixed 220-unit distance only happens to look right for the fallback.
 useMemo(() => {
 if (!mesh?.positions?.length) return;
 let boundingRadius = mesh.boundingRadius;
 if (!boundingRadius) {
 let maxR = 0;
 for (let i = 0; i < mesh.positions.length; i += 3) {
 const r = Math.hypot(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]);
 if (r > maxR) maxR = r;
 }
 boundingRadius = maxR || 65;
 }
 dR.current = boundingRadius * 3.2;
 zoomR.current = { min: boundingRadius * 0.9, max: boundingRadius * 9 };
 }, [mesh]);

 const onTouch = useCallback((e: any) => {
 moveR.current = Date.now(); autoR.current = false;
 const ts = e.nativeEvent.touches;
 if (ts.length === 1) {
 const t = ts[0];
 if (touchR.current) { thR.current -= (t.locationX-touchR.current.x)*0.008; phR.current -= (t.locationY-touchR.current.y)*0.008; phR.current = Math.max(-1.2,Math.min(1.2,phR.current)); }
 touchR.current = { x: t.locationX, y: t.locationY };
 } else if (ts.length === 2) {
 const d = Math.hypot(ts[0].locationX-ts[1].locationX, ts[0].locationY-ts[1].locationY);
 if (pinchR.current > 0) { const s = pinchR.current/d; const { min, max } = zoomR.current; dR.current = Math.max(min,Math.min(max,dR.current*s)); }
 pinchR.current = d;
 }
 }, []);

 const onTouchEnd = useCallback(() => {
 touchR.current = null; pinchR.current = 0;
 setTimeout(() => { if (Date.now()-moveR.current > 1800) autoR.current = true; }, 2000);
 }, []);

 const onGL = useCallback((gl: any) => {
 try {
 glR.current = gl;
 gl.clearColor(0.043, 0.071, 0.125, 1.0);
 gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
 gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
 const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
 const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
 const prog = link(gl, vs, fs);
 gl.useProgram(prog);
 const aPos = gl.getAttribLocation(prog, 'aPos');
 const aCol = gl.getAttribLocation(prog, 'aCol');
 const uMVP = gl.getUniformLocation(prog, 'uMVP');
 glR.current = { gl, prog, aPos, aCol, uMVP };
 } catch (e) { console.warn('[SocketViewer] GL init error:', e); }
 }, []);

 useMemo(() => {
 if (!glR.current || !mesh) return;
 const { gl, prog, aPos, aCol, uMVP } = glR.current;
 const vc = mesh.positions.length / 3;
 const hasIdx = !!(mesh.indices && mesh.indices.length);
 const posB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, posB); gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
 const colB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, colB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vc*3), gl.DYNAMIC_DRAW);
 let idxB: any = null;
 if (hasIdx) { idxB = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxB); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW); }
 const ico = sphere(1.0, 4, 4);
 const icoB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, icoB); gl.bufferData(gl.ARRAY_BUFFER, ico.positions, gl.STATIC_DRAW);
 const icoIB = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, icoIB); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ico.indices, gl.STATIC_DRAW);

 const f2 = frame.length === SENSOR_COUNT ? frame : BASELINE_KPA;
 const sensors = mesh.sensors || new Float32Array(SENSOR_COUNT*3);
 const br = mesh.blendRadius || 30;
 const colBuf = new Float32Array(vc*3);
 for (let v = 0; v < vc; v++) {
 const vx=mesh.positions[v*3], vy=mesh.positions[v*3+1], vz=mesh.positions[v*3+2];
 let sw=0,sr=0,sg=0,sb=0;
 for (let s = 0; s < SENSOR_COUNT; s++) {
 const dx=vx-sensors[s*3], dy=vy-sensors[s*3+1], dz=vz-sensors[s*3+2];
 const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
 if (dist < br) { const w=Math.pow(1-dist/br,2); const c=cssGL(pressureColor(f2[s]||0,maxKpa)); sw+=w; sr+=w*c[0]; sg+=w*c[1]; sb+=w*c[2]; }
 }
 if (sw>1e-4) { colBuf[v*3]=sr/sw; colBuf[v*3+1]=sg/sw; colBuf[v*3+2]=sb/sw; }
 else { colBuf[v*3]=0.12; colBuf[v*3+1]=0.18; colBuf[v*3+2]=0.26; }
 }

 let maxP = 0, maxI = 0;
 for (let s = 0; s < SENSOR_COUNT; s++) { if (f2[s] > maxP) { maxP = f2[s]; maxI = s; } }
 const maxC = cssGL(pressureColor(f2[maxI]||0, maxKpa));

 const draw = (time: number) => {
 try {
 rafR.current = requestAnimationFrame(draw);
 const w = gl.drawingBufferWidth, h2 = gl.drawingBufferHeight;
 gl.viewport(0,0,w,h2);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 if (autoR.current) thR.current += 0.004;
 const asp = w/Math.max(h2,1);
 const proj = mat4Perspective(45*Math.PI/180, asp, 1, 2000);
 const ex=dR.current*Math.cos(phR.current)*Math.sin(thR.current);
 const ey=dR.current*Math.sin(phR.current);
 const ez=dR.current*Math.cos(phR.current)*Math.cos(thR.current);
 const view = mat4LookAt([ex,ey,ez],[0,0,0],[0,1,0]);
 const mvp = mulMVP(proj, view);

 gl.uniformMatrix4fv(uMVP, false, mvp);
 gl.bindBuffer(gl.ARRAY_BUFFER, posB); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER, colB); gl.enableVertexAttribArray(aCol); gl.vertexAttribPointer(aCol,3,gl.FLOAT,false,0,0);
 if (hasIdx) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxB); gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0); }
 else { gl.drawArrays(gl.TRIANGLES, 0, vc); }
 gl.disableVertexAttribArray(aCol); gl.disableVertexAttribArray(aPos);

 // Sensors
 for (let i = 0; i < SENSOR_COUNT; i++) {
 const sc = cssGL(pressureColor(f2[i]||0, maxKpa));
 for (let j = 0; j < 3; j++) colBuf[j] = sc[j];
 const sm = mulMVP(proj, mat4LookAt([sensors[i*3]+3,sensors[i*3+1],sensors[i*3+2]],[sensors[i*3],sensors[i*3+1],sensors[i*3+2]],[0,1,0]));
 gl.uniformMatrix4fv(uMVP, false, sm);
 gl.bindBuffer(gl.ARRAY_BUFFER, icoB); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ARRAY_BUFFER, colB); gl.bufferSubData(gl.ARRAY_BUFFER, 0, colBuf); gl.enableVertexAttribArray(aCol); gl.vertexAttribPointer(aCol,3,gl.FLOAT,false,0,0);
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, icoIB); gl.drawElements(gl.TRIANGLES, ico.indices.length, gl.UNSIGNED_SHORT, 0);
 }
 gl.disableVertexAttribArray(aCol); gl.disableVertexAttribArray(aPos);
 } catch {}
 };
 rafR.current = requestAnimationFrame(draw);

 return () => {
 cancelAnimationFrame(rafR.current);
 gl.deleteBuffer(posB); gl.deleteBuffer(colB);
 if (idxB) gl.deleteBuffer(idxB);
 gl.deleteBuffer(icoB); gl.deleteBuffer(icoIB);
 };
 }, [mesh, frame, maxKpa]);

 if (!GLView) return <View style={[{height},styles.fallback]}><View style={{width:64,height:64,borderRadius:32,borderWidth:2,borderColor:'#22d3ee',justifyContent:'center',alignItems:'center'}}><Text style={{color:'#22d3ee',fontSize:28}}>◇</Text></View><Text style={{color:'#22d3ee',marginTop:10,fontSize:12}}>3D view unavailable on this build</Text></View>;
 if (!mesh) return <View style={[{height},styles.fallback]}><View style={{width:64,height:64,borderRadius:32,borderWidth:2,borderColor:'#22d3ee',justifyContent:'center',alignItems:'center'}}><Text style={{color:'#22d3ee',fontSize:28}}>◇</Text></View><Text style={{color:'#22d3ee',marginTop:10,fontSize:12}}>Socket View</Text></View>;

 return <View style={[{aspectRatio:1.4,height},styles.wrap]} onTouchMove={onTouch} onTouchStart={onTouch} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}><GLView style={StyleSheet.absoluteFill} onContextCreate={onGL} /></View>;
}

const styles = StyleSheet.create({
 wrap: { backgroundColor:'#0B1220', borderRadius:12, overflow:'hidden' },
 fallback: { backgroundColor:'#0a0f1a', justifyContent:'center', alignItems:'center', borderRadius:12, borderWidth:1, borderColor:'#1e293b' },
});
