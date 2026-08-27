// `three` ships its own .d.ts in newer releases, but module resolution here
// (moduleResolution: "bundler") isn't picking it up. Ambient-declare it as
// `any` rather than pulling in @types/three as an extra dependency — this
// file (SocketViewer.web.tsx) is the only consumer and doesn't need strict
// typing on the three.js API surface.
declare module 'three';
