export const color = {
 bg: '#070A11',
 panel: '#0D1320',
 panelDeep: '#0A0F1A',
 panelGradTop: '#101A2B',
 line: '#1A2238',
 lineSoft: '#141C2E',
 stroke: '#253354',
 track: '#182033',
 trackBar: '#131C2E',
 text: '#E8EDF8',
 textDim: '#8A9BC0',
 // Was #4F6192 — only ~3.3:1 against `bg`, below WCAG AA's 4.5:1 minimum
 // for the small (9-11px) captions/disclaimers this is used for. Lightened
 // to land at ~5.2:1 while staying visibly dimmer than textDim.
 textFaint: '#6C82AC',
 cyan: '#00D4F5',
 cyanInk: '#04121A',
 green: '#2EE89E',
 amber: '#F5C842',
 amberInk: '#231C02',
 red: '#F54257',
 cellBg: '#101827',
 cellLine: '#1C2740',
};

export const font = {
 body: 'Manrope_400Regular',
 bodySemi: 'Manrope_600SemiBold',
 bodyBold: 'Manrope_700Bold',
 bodyXbold: 'Manrope_800ExtraBold',
 mono: 'DM Mono_400Regular',
 monoMed: 'DM Mono_500Medium',
};

export const radius = {
 sm: 10,
 md: 14,
 lg: 20,
 xl: 22,
 xxl: 24,
 pill: 999,
};

export const space = {
 xs: 6,
 sm: 10,
 md: 14,
 lg: 18,
 xl: 22,
 xxl: 32,
};

// React Native has no CSS box-shadow — iOS reads the shadow* properties,
// Android only respects `elevation` (and ignores shadowColor/offset/etc
// entirely), so every level below sets both. Nothing in the app used these
// before; every Panel/StatTile/Btn was a flat bordered rectangle relying on
// border color alone for depth, which reads flat against a dark background.
export const shadow = {
 sm: {
 shadowColor: '#000000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.25,
 shadowRadius: 4,
 elevation: 2,
 },
 md: {
 shadowColor: '#000000',
 shadowOffset: { width: 0, height: 6 },
 shadowOpacity: 0.3,
 shadowRadius: 10,
 elevation: 5,
 },
 glow: {
 shadowColor: color.cyan,
 shadowOffset: { width: 0, height: 0 },
 shadowOpacity: 0.35,
 shadowRadius: 12,
 elevation: 6,
 },
};

export const APP_MAX_WIDTH = 460;
