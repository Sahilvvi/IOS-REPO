import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Text, View } from 'react-native';

import { MAX_KPA, SENSOR_COUNT } from '@/pressure/types';
import { color, radius } from '@/theme/tokens';
import { lookAt, mat3From, multiply, perspective } from '@/gl/mat4';
import { PreparedMesh } from '@/gl/mesh';
import { MARKER_FRAG, MARKER_VERT, SHELL_FRAG, SHELL_VERT } from '@/gl/shaders';

const FOV = 42;
const IDLE_BEFORE_SPIN = 3.5;

interface Props {
  mesh: PreparedMesh | null;
  /** Latest sensor frame in kPa. */
  frame: number[];
  hotIndex: number;
  showSensors?: boolean;
  height?: number;
}

interface Scene {
  shell: WebGLProgram;
  marker: WebGLProgram;
  position: WebGLBuffer;
  normal: WebGLBuffer;
  index: WebGLBuffer | null;
  markerPos: WebGLBuffer;
  markerScale: WebGLBuffer;
  vertexCount: number;
  indexCount: number;
  indexType: number;
  blendRadius: number;
  sensors: Float32Array;
}

/**
 * Single cross-platform 3D socket viewer — one `expo-gl` component runs
 * unmodified on iOS, Android, and web (raw WebGL, no three.js: the target
 * shader language is already GLSL ES 1.0, exactly what expo-gl exposes, so a
 * heavier 3D library buys nothing). Replaces the previous native-only
 * (SocketViewer.native.tsx, no lighting, a real indexing bug in its
 * procedural fallback mesh) and web-only (SocketViewer.web.tsx, three.js)
 * pair — ported from the ava-fit-complete reference build.
 */
export function SocketViewer({ mesh, frame, hotIndex, showSensors = true, height = 290 }: Props) {
  const [failed, setFailed] = useState(false);

  const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const meshRef = useRef<PreparedMesh | null>(mesh);
  const showRef = useRef(showSensors);
  const hotRef = useRef(hotIndex);
  const wanted = useRef(new Float32Array(SENSOR_COUNT));
  const eased = useRef(new Float32Array(SENSOR_COUNT));
  const scales = useRef(new Float32Array(SENSOR_COUNT).fill(1));
  const cam = useRef({ theta: 0.6, phi: 1.42, dist: 300, home: 300, idle: 0, clock: 0 });
  const drag = useRef({ x: 0, y: 0, pinch: 0, active: false, lastTap: 0 });

  showRef.current = showSensors;
  hotRef.current = hotIndex;
  for (let i = 0; i < SENSOR_COUNT; i++) {
    wanted.current[i] = Math.min(1, (frame[i] ?? 0) / MAX_KPA);
  }

  /* Re-upload when the wearer loads a different socket. */
  useEffect(() => {
    meshRef.current = mesh;
    const gl = glRef.current;
    if (gl && mesh) {
      try {
        uploadMesh(gl, sceneRef.current, mesh, cam.current);
      } catch {
        setFailed(true);
      }
    }
  }, [mesh]);

  const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
    try {
      glRef.current = gl;
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(10 / 255, 15 / 255, 26 / 255, 1);

      const scene: Scene = {
        shell: link(gl, SHELL_VERT, SHELL_FRAG),
        marker: link(gl, MARKER_VERT, MARKER_FRAG),
        position: gl.createBuffer()!,
        normal: gl.createBuffer()!,
        index: null,
        markerPos: gl.createBuffer()!,
        markerScale: gl.createBuffer()!,
        vertexCount: 0,
        indexCount: 0,
        indexType: gl.UNSIGNED_SHORT,
        blendRadius: 40,
        sensors: new Float32Array(SENSOR_COUNT * 3),
      };
      sceneRef.current = scene;
      if (meshRef.current) uploadMesh(gl, scene, meshRef.current, cam.current);

      let raf = 0;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        draw(gl, scene, cam.current, drag.current, eased.current, wanted.current, scales.current, hotRef.current, showRef.current);
      };
      loop();
      return () => cancelAnimationFrame(raf);
    } catch (err) {
      console.warn('[SocketViewer] GL unavailable', err);
      setFailed(true);
    }
  }, []);

  /* Orbit / pinch. Mouse wheel is wired separately on web. */
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const now = Date.now();
        if (now - drag.current.lastTap < 300) {
          cam.current.theta = 0.6;
          cam.current.phi = 1.42;
          cam.current.dist = cam.current.home;
        }
        drag.current.lastTap = now;
        drag.current.x = 0;
        drag.current.y = 0;
        drag.current.pinch = 0;
        drag.current.active = true;
        cam.current.idle = 0;
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches;
        cam.current.idle = 0;

        if (touches.length === 2) {
          const d = Math.hypot(
            touches[0].pageX - touches[1].pageX,
            touches[0].pageY - touches[1].pageY,
          );
          if (drag.current.pinch) {
            cam.current.dist = clampDist(cam.current, cam.current.dist * (drag.current.pinch / d));
          }
          drag.current.pinch = d;
          return;
        }

        drag.current.pinch = 0;
        cam.current.theta -= (gesture.dx - drag.current.x) * 0.008;
        cam.current.phi = Math.max(
          0.2,
          Math.min(Math.PI - 0.2, cam.current.phi - (gesture.dy - drag.current.y) * 0.008),
        );
        drag.current.x = gesture.dx;
        drag.current.y = gesture.dy;
      },
      onPanResponderRelease: () => {
        drag.current.active = false;
        drag.current.pinch = 0;
      },
      onPanResponderTerminate: () => {
        drag.current.active = false;
        drag.current.pinch = 0;
      },
    }),
  ).current;

  const hostRef = useRef<View | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = hostRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.current.idle = 0;
      cam.current.dist = clampDist(cam.current, cam.current.dist * (1 + Math.sign(e.deltaY) * 0.08));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <View ref={hostRef} style={[styles.host, { height }]} {...responder.panHandlers}>
      {failed ? (
        <Text style={styles.fallback}>
          3D view needs WebGL. Everything else on this screen still works.
        </Text>
      ) : (
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
      )}
    </View>
  );
}

/* ── GL plumbing ────────────────────────────────────────────────────────── */

function clampDist(cam: { home: number }, next: number) {
  return Math.max(cam.home * 0.35, Math.min(cam.home * 2.4, next));
}

function compile(gl: ExpoWebGLRenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

function link(gl: ExpoWebGLRenderingContext, vert: string, frag: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`program: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

/** Array uniforms are exposed as either "name" or "name[0]" depending on driver. */
function arrayLoc(gl: ExpoWebGLRenderingContext, p: WebGLProgram, name: string) {
  return gl.getUniformLocation(p, name) ?? gl.getUniformLocation(p, `${name}[0]`);
}

function uploadMesh(
  gl: ExpoWebGLRenderingContext,
  scene: Scene | null,
  mesh: PreparedMesh,
  cam: { dist: number; home: number },
) {
  if (!scene) return;

  gl.bindBuffer(gl.ARRAY_BUFFER, scene.position);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, scene.normal);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);

  scene.vertexCount = mesh.positions.length / 3;
  if (mesh.indices) {
    scene.index = scene.index ?? gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, scene.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    scene.indexCount = mesh.indices.length;
    scene.indexType = mesh.indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
  } else {
    scene.index = null;
    scene.indexCount = 0;
  }

  // markers sit a hair proud of the wall so they are not z-fought by it
  const lift = mesh.boundingRadius * 0.012;
  const pts = new Float32Array(SENSOR_COUNT * 3);
  for (let i = 0; i < SENSOR_COUNT * 3; i++) {
    pts[i] = mesh.sensors[i] + mesh.sensorNormals[i] * lift;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, scene.markerPos);
  gl.bufferData(gl.ARRAY_BUFFER, pts, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, scene.markerScale);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(SENSOR_COUNT).fill(1), gl.DYNAMIC_DRAW);

  scene.sensors = mesh.sensors;
  scene.blendRadius = mesh.blendRadius;

  cam.home = (mesh.boundingRadius / Math.sin((FOV * Math.PI) / 360)) * 1.05;
  cam.dist = cam.home;
}

function bindAttrib(
  gl: ExpoWebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  buffer: WebGLBuffer,
  size: number,
) {
  const loc = gl.getAttribLocation(program, name);
  if (loc < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
}

function draw(
  gl: ExpoWebGLRenderingContext,
  scene: Scene,
  cam: { theta: number; phi: number; dist: number; home: number; idle: number; clock: number },
  drag: { active: boolean },
  eased: Float32Array,
  wanted: Float32Array,
  scales: Float32Array,
  hot: number,
  showSensors: boolean,
) {
  cam.clock += 0.016;
  cam.idle += 0.016;
  if (!drag.active && cam.idle > IDLE_BEFORE_SPIN) cam.theta += 0.0025;

  for (let i = 0; i < SENSOR_COUNT; i++) eased[i] += (wanted[i] - eased[i]) * 0.12;

  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (!scene.vertexCount) return;

  const eye = [
    cam.dist * Math.sin(cam.phi) * Math.sin(cam.theta),
    cam.dist * Math.cos(cam.phi),
    cam.dist * Math.sin(cam.phi) * Math.cos(cam.theta),
  ];
  const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
  const proj = perspective(FOV, w / Math.max(1, h), Math.max(0.01, cam.home * 0.01), cam.home * 20);
  const viewProj = multiply(proj, view);
  const normalMat = mat3From(view);

  // shell
  gl.useProgram(scene.shell);
  bindAttrib(gl, scene.shell, 'aPosition', scene.position, 3);
  bindAttrib(gl, scene.shell, 'aNormal', scene.normal, 3);
  gl.uniformMatrix4fv(gl.getUniformLocation(scene.shell, 'uViewProj'), false, viewProj);
  gl.uniformMatrix3fv(gl.getUniformLocation(scene.shell, 'uNormalMat'), false, normalMat);
  gl.uniform3fv(arrayLoc(gl, scene.shell, 'uSensors'), scene.sensors);
  gl.uniform1fv(arrayLoc(gl, scene.shell, 'uWeights'), eased);
  gl.uniform1f(gl.getUniformLocation(scene.shell, 'uRadius'), scene.blendRadius);

  if (scene.index) {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, scene.index);
    gl.drawElements(gl.TRIANGLES, scene.indexCount, scene.indexType, 0);
  } else {
    gl.drawArrays(gl.TRIANGLES, 0, scene.vertexCount);
  }

  // sensor dots
  if (showSensors) {
    for (let i = 0; i < SENSOR_COUNT; i++) {
      scales[i] = i === hot ? 1.5 + Math.sin(cam.clock * 4) * 0.35 : 1;
    }
    gl.useProgram(scene.marker);
    gl.bindBuffer(gl.ARRAY_BUFFER, scene.markerScale);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, scales);
    bindAttrib(gl, scene.marker, 'aPosition', scene.markerPos, 3);
    bindAttrib(gl, scene.marker, 'aScale', scene.markerScale, 1);
    gl.uniformMatrix4fv(gl.getUniformLocation(scene.marker, 'uViewProj'), false, viewProj);
    gl.uniform1f(gl.getUniformLocation(scene.marker, 'uSize'), Math.max(6, h * 0.022));
    gl.drawArrays(gl.POINTS, 0, SENSOR_COUNT);
  }

  gl.flush();
  gl.endFrameEXP();
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    borderRadius: radius.md + 2,
    overflow: 'hidden',
    backgroundColor: color.panelDeep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallback: {
    color: color.textFaint,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
