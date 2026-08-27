/**
 * GLSL shaders for the native 3D socket viewer.
 * These are injected into expo-gl's OpenGL ES context.
 */

export const VERT_SOCKET = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute float aPressure;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vPressure;

void main() {
 vec4 worldPos = uModel * vec4(aPosition, 1.0);
 gl_Position = uProjection * uView * worldPos;
 vNormal = mat3(uModel) * aNormal;
 vPosition = worldPos.xyz;
 vPressure = aPressure;
}
`;

export const FRAG_SOCKET = `
precision mediump float;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vPressure;

uniform vec3 uLightDir;
uniform vec3 uAmbient;
uniform vec3 uWireColor;
uniform float uHeatmap;
uniform float uMaxKpa;

vec3 pressureColor(float t) {
 // 5-stop ramp matching the 2D grid
 vec3 c0 = vec3(0.06, 0.17, 0.13); // 0 kPa
 vec3 c1 = vec3(0.18, 0.63, 0.43); // 25%
 vec3 c2 = vec3(0.84, 0.75, 0.26); // 50%
 vec3 c3 = vec3(0.93, 0.55, 0.24); // 75%
 vec3 c4 = vec3(0.93, 0.24, 0.31); // 100%

 t = clamp(t / uMaxKpa, 0.0, 1.0);
 if (t < 0.25) return mix(c0, c1, t / 0.25);
 if (t < 0.5) return mix(c1, c2, (t - 0.25) / 0.25);
 if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
 return mix(c3, c4, (t - 0.75) / 0.25);
}

void main() {
 vec3 normal = normalize(vNormal);
 float diffuse = max(dot(normal, uLightDir), 0.0);
 float lighting = uAmbient + diffuse * 0.7;

 vec3 baseColor = uHeatmap > 0.5 ? pressureColor(vPressure) : uWireColor;
 vec3 color = baseColor * lighting;

 // Subtle rim
 vec3 viewDir = normalize(-vPosition);
 float rim = 1.0 - max(dot(viewDir, normal), 0.0);
 color += uWireColor * rim * 0.15;

 gl_FragColor = vec4(color, 0.9);
}
`;

export const VERT_SENSOR = `
attribute vec3 aPosition;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform float uScale;

void main() {
 gl_Position = uProjection * uView * uModel * vec4(aPosition * uScale, 1.0);
}
`;

export const FRAG_SENSOR = `
precision mediump float;
uniform vec3 uColor;

void main() {
 gl_FragColor = vec4(uColor, 1.0);
}
`;
