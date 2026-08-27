/**
 * Type-resolution shim only — never actually bundled.
 *
 * Metro's platform-extension resolution always prefers SocketViewer.native.tsx
 * (iOS/Android) or SocketViewer.web.tsx (web) over this bare file when both
 * exist, so this file's content never runs. It exists purely because plain
 * `tsc` (used by `npm run typecheck`, unlike Metro) is not platform-extension
 * aware and needs `./SocketViewer` to resolve to something concrete.
 *
 * (An earlier version of this file tried `export { default } from
 * Platform.select({...})()` — not valid syntax; `export ... from` requires a
 * static string literal, it can't be computed.)
 */
export { default } from './SocketViewer.native';
