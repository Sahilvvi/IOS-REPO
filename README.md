# AVA Fit — iOS Prosthetic Socket Monitoring App

Cross-platform Expo/React Native app for real-time prosthetic socket pressure monitoring.

## What This Is

This is a complete rewrite of the AVA Fit mobile app, built with:
- **Expo SDK 57** + **Expo Router** (file-based navigation)
- **React Native 0.86** + **React 19**
- **TypeScript** strict mode
- **react-native-ble-plx** for BLE connectivity
- **expo-gl** for 3D socket rendering
- **react-native-reanimated** for animations

## Project Structure

```
ava-fit-ios/
├── app/
│ ├── _layout.tsx # Root layout, fonts, providers
│ └── (tabs)/
│ ├── _layout.tsx # Tab navigator
│ ├── index.tsx # Today screen (dashboard)
│ ├── fit.tsx # Fit analysis screen
│ ├── trends.tsx # Historical trends
│ └── care.tsx # Care team & mood logging
├── src/
│ ├── components/ # Reusable UI components
│ │ ├── AnimatedPanel.tsx
│ │ ├── FitRing.tsx # SVG ring with animated score
│ │ ├── PressureGrid.tsx # 18-sensor 3x6 grid
│ │ ├── ScreenScaffold.tsx
│ │ ├── SocketViewer.native.tsx # OpenGL 3D viewer
│ │ └── ui.tsx # Design system primitives
│ ├── pressure/ # Core pressure pipeline
│ │ ├── types.ts # Shared types, SENSOR_COUNT, BASELINE_KPA
│ │ ├── channels.ts # BLE→anatomical sensor permutation
│ │ ├── kalmanFilter.ts # 18-channel Kalman bank
│ │ ├── SimulatedPressureSource.ts # Demo data source
│ │ ├── BlePressureSource.ts # Real BLE source
│ │ ├── derive.ts # FitReading + ClinicalResult
│ │ ├── risk.ts # Pressure injury risk screening
│ │ ├── geometry.ts # Socket shape suggestions
│ │ ├── ramp.ts # Pressure→color ramp (shared with GLSL)
│ │ ├── PressureProvider.tsx # React context for state
│ │ └── sessionLogger.ts # CSV session recording
│ ├── gl/ # 3D rendering
│ │ ├── shaders.ts # GLSL vertex/fragment shaders
│ │ ├── mat4.ts # Matrix math utilities
│ │ └── mesh.ts # Mesh preparation, sensor placement
│ ├── theme/
│ │ └── tokens.ts # Colors, fonts, spacing
│ ├── data/ # Static data
│ │ ├── socketMesh.ts # Bundled socket mesh (base64)
│ │ ├── moods.ts # Mood options for care screen
│ │ └── roster.ts # Care team roster
│ ├── services/ # Business logic
│ │ ├── ProfileService.ts # Patient profile CRUD (SecureStore)
│ │ ├── SensorMapper.ts # Sensor placement algorithms
│ │ └── StlParser.ts # STL/OBJ file parsing
│ └── haptics.ts # Haptic feedback wrappers
├── assets/ # Icons, fonts
├── package.json
├── tsconfig.json
├── babel.config.js
└── metro.config.js
```

## Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- **Xcode** (for iOS builds)
- **Expo CLI**: `npm install -g expo-cli`

### Install

```bash
cd ava-fit-ios
npm install
```

### Run on iOS Simulator

```bash
npx expo start --ios
```

### Run on Physical iPhone

```bash
# Development build
npx expo run:ios
```

### Run on Web

```bash
npx expo start --web
```

## Connecting to Hardware

The app connects to the ESP32-S3 prosthetic socket MCU via BLE.

**Device name:** `PROJECT-X-MCU` (or `PROJECT-X-MCU-LEGACY`, `PROJECT-X-18Node`)
**Service UUID:** `abcd0001-1111-2222-3333-abcdefabcdef`
**Pressure characteristic:** `abcd0002-1111-2222-3333-abcdefabcdef`

The app automatically falls back to simulation if BLE is unavailable.

## BLE Wire Format

```
P:kpa0,kpa1,...,kpa17|I:ax,ay,az,gx,gy,gz,temp|A:activity
```

- `P:` — 18 pressure values in kPa
- `I:` — IMU: accelerometer xyz, gyroscope xyz, temperature
- `A:` — Activity classifier tag (WALKING, STANDING, etc.)

## Key Features

### Pressure Pipeline
1. **BLE source** — Real-time pressure data from ESP32-S3
2. **Kalman filter** — 18-channel drift-correcting filter
3. **Risk analysis** — Pressure-time integral, concentration, no-relief detection
4. **Geometry suggestions** — Relieve/support/monitor per region
5. **Session logging** — CSV export of pressure + IMU data

### Screens
- **Today** — Dashboard: fit score, alerts, wear time, daily plan
- **Fit** — Detailed analysis: 18-sensor grid, risk scores, suggestions
- **Trends** — 7-day comfort chart, limb volume sparkline, insights
- **Care** — Clinician contacts, mood logging, appointment info

### 3D Socket Viewer
- Native OpenGL ES renderer (via expo-gl)
- Pressure heatmap on socket surface
- Sensor spheres color-coded by pressure
- Touch-to-rotate controls

## Architecture Notes

- **No external state management** — React Context + hooks only
- **Platform-specific rendering** — `SocketViewer.native.tsx` for iOS, `SocketViewer.web.tsx` for web
- **Permission-first BLE** — iOS permissions declared in `app.json`
- **Offline-capable** — All processing runs locally, no server required

## Next Steps

1. **Test on simulator** — app runs with simulated data immediately
2. **Test BLE** — connect to actual ESP32-S3 hardware
3. **Complete GL renderer** — SocketViewer.native.tsx has a placeholder, needs full OpenGL implementation
4. **Port volume forecast** — add TensorFlow Lite for limb volume prediction
5. **Add calibration** — zero/tare, sensor mapping verification UI
