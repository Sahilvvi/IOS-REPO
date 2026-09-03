import { SENSOR_COUNT } from '@/pressure/types';

/**
 * Socket shell. The heatmap is an inverse-cube-distance blend of the 18 sensor
 * weights evaluated per fragment, so the gradient follows the geometry rather
 * than a texture that would have to be re-unwrapped for every scan.
 *
 * rampC() mirrors src/pressure/ramp.ts — change both together.
 */
export const SHELL_VERT = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uViewProj;
uniform mat3 uNormalMat;
varying vec3 vPos;
varying vec3 vNormal;
void main() {
  vPos = aPosition;
  vNormal = normalize(uNormalMat * aNormal);
  gl_Position = uViewProj * vec4(aPosition, 1.0);
}`;

export const SHELL_FRAG = `
precision highp float;
varying vec3 vPos;
varying vec3 vNormal;
uniform vec3 uSensors[${SENSOR_COUNT}];
uniform float uWeights[${SENSOR_COUNT}];
uniform float uRadius;

vec3 rampC(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.055, 0.129, 0.192);
  vec3 c1 = vec3(0.180, 0.627, 0.431);
  vec3 c2 = vec3(0.839, 0.745, 0.259);
  vec3 c3 = vec3(0.925, 0.549, 0.235);
  vec3 c4 = vec3(0.933, 0.235, 0.314);
  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

void main() {
  float num = 0.0;
  float den = 0.0;
  for (int i = 0; i < ${SENSOR_COUNT}; i++) {
    float d = distance(vPos, uSensors[i]) / uRadius;
    float w = 1.0 / (0.0001 + d * d * d);
    num += w * uWeights[i];
    den += w;
  }
  float v = den > 0.0 ? num / den : 0.0;
  vec3 base = rampC(v);
  vec3 n = normalize(vNormal);
  float lam = 0.42 + 0.58 * max(0.0, dot(n, normalize(vec3(0.45, 0.75, 0.6))));
  float rim = pow(1.0 - max(0.0, dot(n, vec3(0.0, 0.0, 1.0))), 2.5) * 0.35;
  gl_FragColor = vec4(base * lam + vec3(0.0, 0.55, 0.72) * rim, 1.0);
}`;

/** Sensor dots, drawn as point sprites — cheaper and crisper than sphere meshes. */
export const MARKER_VERT = `
attribute vec3 aPosition;
attribute float aScale;
uniform mat4 uViewProj;
uniform float uSize;
varying float vScale;
void main() {
  vScale = aScale;
  gl_Position = uViewProj * vec4(aPosition, 1.0);
  gl_PointSize = uSize * aScale;
}`;

export const MARKER_FRAG = `
precision mediump float;
varying float vScale;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r = length(d);
  if (r > 0.5) discard;
  float edge = smoothstep(0.5, 0.42, r);
  float alpha = vScale > 1.05 ? 1.0 : 0.55;
  vec3 tint = vScale > 1.05 ? vec3(1.0) : vec3(0.859, 0.902, 1.0);
  gl_FragColor = vec4(tint, alpha * edge);
}`;
