# App Redesign — Retro Camcorder UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Timelapse-Pi mobile app with a retro 90s camcorder aesthetic, merge Dashboard+Preview into a single Home screen, add new camera controls to backend and app, slim down Settings.

**Architecture:** Backend gets 7 new camera control fields in config + camera service mappings. App gets a complete visual overhaul (Hi8 palette, Phosphor duotone icons, VT323 pixel font), navigation restructured from 4 tabs to 3, and a new Home screen that combines viewfinder preview with camera/capture controls.

**Tech Stack:** FastAPI/picamera2 (backend), React Native/Expo SDK 54, Phosphor Icons (duotone), VT323 font, React Query, TypeScript

**Spec:** `docs/superpowers/specs/2026-04-05-app-redesign-design.md`

---

## File Map

### Files to Create
| Path | Responsibility |
|------|----------------|
| `app/src/screens/HomeScreen.tsx` | Main home screen — assembles all home sub-components |
| `app/src/components/home/StatusStrip.tsx` | Storage + battery status bar |
| `app/src/components/home/RuntimeEstimates.tsx` | BYPASS/AUTO runtime + frame count estimates |
| `app/src/components/home/Viewfinder.tsx` | 4:3 preview with VHS overlay (brackets, crosshair, mode, timestamp) |
| `app/src/components/home/PreviewControls.tsx` | Snap + Live toggle buttons |
| `app/src/components/home/CameraSettings.tsx` | Tier 1 + Tier 2 camera control chips with inline strips |
| `app/src/components/home/CaptureSettings.tsx` | Intervals, daylight toggle, sunrise/sunset offsets |
| `app/src/components/home/CaptureControls.tsx` | Capture Still + Record/Stop buttons |

### Files to Modify
| Path | Changes |
|------|---------|
| `pi/services/config.py` | Add 7 new camera defaults to DEFAULT_CONFIG |
| `pi/services/camera.py` | Add 7 new control mappings in update_settings() |
| `pi/api/routers/settings.py` | Auto-apply camera settings after config save |
| `app/package.json` | Add phosphor-react-native, react-native-svg, expo-font, expo-location |
| `app/src/theme.ts` | Complete rewrite — Hi8 palette, new typography with VT323 |
| `app/App.tsx` | Add font loading with expo-font |
| `app/src/api/client.ts` | Update PiStatus type with battery_voltage, battery_soc_pct |
| `app/src/navigation/AppNavigator.tsx` | 3 tabs (Home, Gallery, Settings), Phosphor icons |
| `app/src/screens/settings/SettingsScreen.tsx` | Slim to Location + Device + Network, add GPS button |
| `app/src/screens/settings/NetworkScreen.tsx` | Add manual network entry, restyle |
| `app/src/components/ConnectionBar.tsx` | Restyle to Hi8 palette |
| `app/src/screens/ConnectionScreen.tsx` | Restyle to Hi8 palette |
| `app/src/screens/gallery/BatchListScreen.tsx` | Restyle to Hi8 palette |
| `app/src/screens/gallery/BatchDetailScreen.tsx` | Restyle to Hi8 palette |
| `app/src/screens/gallery/ImageViewerScreen.tsx` | Restyle to Hi8 palette |
| `app/src/screens/render/RenderModal.tsx` | Restyle to Hi8 palette |
| `app/src/components/BatchCard.tsx` | Restyle to Hi8 palette |
| `app/src/components/ImageThumbnail.tsx` | Restyle to Hi8 palette |

### Files to Delete
| Path | Reason |
|------|--------|
| `app/src/screens/DashboardScreen.tsx` | Replaced by HomeScreen |
| `app/src/screens/PreviewScreen.tsx` | Replaced by HomeScreen |

---

## Task 1: Backend — Add New Camera Controls to Config

**Files:**
- Modify: `pi/services/config.py`

- [ ] **Step 1: Add new camera defaults to DEFAULT_CONFIG**

In `pi/services/config.py`, update the `camera` section of `DEFAULT_CONFIG`:

```python
    "sunrise_offset_min": 0,
    "sunset_offset_min": 0,
    "camera": {
        "iso": 100,
        "exposure_mode": "auto",
        "shutter_speed": None,
        "awb_mode": "auto",
        "ev_compensation": 0.0,
        "metering_mode": "centre",
        "brightness": 0.0,
        "contrast": 1.0,
        "saturation": 1.0,
        "sharpness": 1.0,
        "noise_reduction": "off",
    },
```

- [ ] **Step 2: Verify config loads with new defaults**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/pi
python3 -c "
from services.config import ConfigService, DEFAULT_CONFIG
c = DEFAULT_CONFIG['camera']
assert c['ev_compensation'] == 0.0
assert c['metering_mode'] == 'centre'
assert c['brightness'] == 0.0
assert c['contrast'] == 1.0
assert c['saturation'] == 1.0
assert c['sharpness'] == 1.0
assert c['noise_reduction'] == 'off'
print('All new camera defaults present')
"
```

Expected: `All new camera defaults present`

- [ ] **Step 3: Commit**

```bash
git add pi/services/config.py
git commit -m "feat: add new camera control defaults to config schema"
```

---

## Task 2: Backend — Add New Camera Control Mappings

**Files:**
- Modify: `pi/services/camera.py`

- [ ] **Step 1: Extend update_settings() with new control mappings**

Replace the entire `update_settings` method in `pi/services/camera.py`:

```python
    def update_settings(
        self,
        iso: int = None,
        exposure_mode: str = None,
        awb_mode: str = None,
        shutter_speed: int = None,
        ev_compensation: float = None,
        metering_mode: str = None,
        brightness: float = None,
        contrast: float = None,
        saturation: float = None,
        sharpness: float = None,
        noise_reduction: str = None,
    ) -> None:
        """Apply camera control settings."""
        controls = {}
        if iso is not None:
            controls["AnalogueGain"] = iso / 100.0
        if exposure_mode == "auto":
            controls["AeEnable"] = True
        elif exposure_mode == "manual":
            controls["AeEnable"] = False
        if awb_mode is not None:
            awb_map = {
                "auto": 0,
                "daylight": 1,
                "cloudy": 2,
                "tungsten": 3,
                "fluorescent": 4,
            }
            if awb_mode in awb_map:
                controls["AwbMode"] = awb_map[awb_mode]
        if shutter_speed is not None:
            controls["ExposureTime"] = shutter_speed
        if ev_compensation is not None:
            controls["ExposureValue"] = ev_compensation
        if metering_mode is not None:
            metering_map = {"centre": 0, "spot": 1, "matrix": 2}
            if metering_mode in metering_map:
                controls["AeMeteringMode"] = metering_map[metering_mode]
        if brightness is not None:
            controls["Brightness"] = brightness
        if contrast is not None:
            controls["Contrast"] = contrast
        if saturation is not None:
            controls["Saturation"] = saturation
        if sharpness is not None:
            controls["Sharpness"] = sharpness
        if noise_reduction is not None:
            nr_map = {"off": 0, "fast": 1, "high_quality": 2, "minimal": 3}
            if noise_reduction in nr_map:
                controls["NoiseReductionMode"] = nr_map[noise_reduction]
        if controls:
            with self._lock:
                self._camera.set_controls(controls)
```

- [ ] **Step 2: Commit**

```bash
git add pi/services/camera.py
git commit -m "feat: add 7 new camera control mappings (EV, metering, brightness, contrast, saturation, sharpness, NR)"
```

---

## Task 3: Backend — Auto-Apply Camera Settings on Config Change

**Files:**
- Modify: `pi/api/routers/settings.py`

- [ ] **Step 1: Update settings endpoint to apply camera controls after save**

Replace the contents of `pi/api/routers/settings.py`:

```python
from fastapi import APIRouter, Depends

from api.dependencies import ServiceContainer, get_services

router = APIRouter()


@router.get("/settings")
async def get_settings(services: ServiceContainer = Depends(get_services)):
    return services.config.load()


@router.patch("/settings")
async def update_settings(
    updates: dict, services: ServiceContainer = Depends(get_services)
):
    config = services.config.merge(updates)

    # Auto-apply camera settings so preview reflects changes immediately
    if "camera" in updates and services.camera.is_started:
        cam = config.get("camera", {})
        services.camera.update_settings(
            iso=cam.get("iso"),
            exposure_mode=cam.get("exposure_mode"),
            awb_mode=cam.get("awb_mode"),
            shutter_speed=cam.get("shutter_speed"),
            ev_compensation=cam.get("ev_compensation"),
            metering_mode=cam.get("metering_mode"),
            brightness=cam.get("brightness"),
            contrast=cam.get("contrast"),
            saturation=cam.get("saturation"),
            sharpness=cam.get("sharpness"),
            noise_reduction=cam.get("noise_reduction"),
        )

    return config
```

- [ ] **Step 2: Commit**

```bash
git add pi/api/routers/settings.py
git commit -m "feat: auto-apply camera settings on config change for live preview feedback"
```

---

## Task 4: App — Install Dependencies

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install new packages**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/app
npx expo install phosphor-react-native react-native-svg expo-font expo-location @expo-google-fonts/vt323
```

Note: `react-native-svg` may already be installed as a transitive dependency. `expo install` handles version compatibility with SDK 54.

- [ ] **Step 2: Verify installation**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/app
node -e "require('phosphor-react-native'); console.log('phosphor OK')"
node -e "require('@expo-google-fonts/vt323'); console.log('vt323 OK')"
```

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore: add phosphor-react-native, expo-font, expo-location, VT323 font"
```

---

## Task 5: App — Rewrite Theme

**Files:**
- Modify: `app/src/theme.ts`

- [ ] **Step 1: Replace theme.ts with Hi8 palette**

Replace the entire contents of `app/src/theme.ts`:

```typescript
export const colors = {
  background: '#0d0d14',
  surface: '#111118',
  surfaceLight: '#16161e',
  border: '#1e1e28',
  borderLight: '#2a2a34',
  text: '#cccccc',
  textSecondary: '#999999',
  textMuted: '#666666',
  textDim: '#444444',
  accent: '#cccccc',
  record: '#cc3333',
  recordGlow: 'rgba(204,51,51,0.4)',
  recordBg: '#1e1218',
  warning: '#ff9900',
  danger: '#cc3333',
  success: '#4a9968',
  successBg: '#2a5533',

  // Legacy aliases for components not yet restyled
  primary: '#cccccc',
  error: '#cc3333',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  // VT323 pixel font styles (set fontFamily after font loads)
  osd: { fontSize: 11, color: '#cccccc', letterSpacing: 0.5 },
  label: { fontSize: 9, textTransform: 'uppercase' as const, color: '#666666', letterSpacing: 2 },
  title: { fontSize: 18, color: '#cccccc' },

  // System font styles
  value: { fontSize: 11, color: '#cccccc' },
  body: { fontSize: 14, color: '#cccccc' },
  caption: { fontSize: 12, color: '#999999' },

  // Legacy aliases
  subtitle: { fontSize: 16, fontWeight: '600' as const, color: '#cccccc' },
};

// Text glow effect — use with textShadowColor + textShadowRadius
export const glowStyle = {
  textShadowColor: 'rgba(200,200,200,0.3)',
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 0 },
};

// Record glow effect — use with shadowColor etc.
export const recordGlowStyle = {
  shadowColor: '#cc3333',
  shadowRadius: 8,
  shadowOpacity: 0.4,
  shadowOffset: { width: 0, height: 0 },
};

// VT323 font family name (set after loading)
export const PIXEL_FONT = 'VT323_400Regular';
```

- [ ] **Step 2: Commit**

```bash
git add app/src/theme.ts
git commit -m "feat: rewrite theme with Hi8 camcorder palette, glow effects, VT323 support"
```

---

## Task 6: App — Font Loading + App.tsx Update

**Files:**
- Modify: `app/App.tsx`

- [ ] **Step 1: Add VT323 font loading to App.tsx**

Replace the entire contents of `app/App.tsx`:

```typescript
import React from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, VT323_400Regular } from '@expo-google-fonts/vt323';
import { ConnectionProvider } from './src/providers/ConnectionProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors } from './src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5000,
    },
  },
});

export default function App() {
  const [fontsLoaded] = useFonts({ VT323_400Regular });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <QueryClientProvider client={queryClient}>
        <ConnectionProvider>
          <NavigationContainer
            theme={{
              dark: true,
              colors: {
                primary: colors.accent,
                background: colors.background,
                card: colors.background,
                text: colors.text,
                border: colors.border,
                notification: colors.accent,
              },
              fonts: {
                regular: { fontFamily: 'System', fontWeight: '400' },
                medium: { fontFamily: 'System', fontWeight: '500' },
                bold: { fontFamily: 'System', fontWeight: '700' },
                heavy: { fontFamily: 'System', fontWeight: '900' },
              },
            }}
          >
            <AppNavigator />
          </NavigationContainer>
        </ConnectionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Verify app starts**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/app && npx expo start
```

Verify: App should show loading spinner briefly while VT323 loads, then render normally. Background should be dark `#0d0d14`.

- [ ] **Step 3: Commit**

```bash
git add app/App.tsx
git commit -m "feat: add VT323 pixel font loading to App.tsx"
```

---

## Task 7: App — Update API Types

**Files:**
- Modify: `app/src/api/client.ts`

- [ ] **Step 1: Update PiStatus interface**

In `app/src/api/client.ts`, replace the `PiStatus` interface:

```typescript
export interface PiStatus {
  mode: 'auto' | 'bypass';
  capture_state: 'idle' | 'running' | 'stopped';
  capture_count: number;
  last_capture: { image_id: string; batch_id: string } | null;
  storage_used_pct: number;
  storage_free_mb: number;
  battery_voltage: number | null;
  battery_soc_pct: number | null;
  battery_mah: number;
  runtime_estimate_hours: number | null;
  software_interval_sec: number;
  hardware_interval_sec: number;
  uptime_sec: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/api/client.ts
git commit -m "feat: add battery_voltage and battery_soc_pct to PiStatus type"
```

---

## Task 8: App — Navigation Restructure

**Files:**
- Modify: `app/src/navigation/AppNavigator.tsx`
- Create: `app/src/screens/HomeScreen.tsx` (skeleton)

- [ ] **Step 1: Create HomeScreen skeleton**

Create `app/src/screens/HomeScreen.tsx`:

```typescript
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, PIXEL_FONT } from '../theme';

export function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.placeholder}>Home Screen — Coming Soon</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  placeholder: { color: colors.text, fontSize: 16, textAlign: 'center', marginTop: 100, fontFamily: PIXEL_FONT },
});
```

- [ ] **Step 2: Rewrite AppNavigator with 3 tabs and Phosphor icons**

Replace the entire contents of `app/src/navigation/AppNavigator.tsx`:

```typescript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useConnection } from '../providers/ConnectionProvider';
import { ConnectionBar } from '../components/ConnectionBar';
import { ConnectionScreen } from '../screens/ConnectionScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { BatchListScreen } from '../screens/gallery/BatchListScreen';
import { BatchDetailScreen } from '../screens/gallery/BatchDetailScreen';
import { ImageViewerScreen } from '../screens/gallery/ImageViewerScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { NetworkScreen } from '../screens/settings/NetworkScreen';
import { colors, PIXEL_FONT } from '../theme';
import { VideoCamera, SquaresFour, GearSix } from 'phosphor-react-native';

const Tab = createBottomTabNavigator();
const GalleryStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function GalleryStackScreen() {
  return (
    <GalleryStack.Navigator screenOptions={{ headerShown: false }}>
      <GalleryStack.Screen name="BatchList" component={BatchListScreen} />
      <GalleryStack.Screen name="BatchDetail" component={BatchDetailScreen} />
      <GalleryStack.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
    </GalleryStack.Navigator>
  );
}

function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsMain" component={SettingsScreen} />
      <SettingsStack.Screen name="Network" component={NetworkScreen} />
    </SettingsStack.Navigator>
  );
}

function MainTabs() {
  return (
    <>
      <ConnectionBar />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingTop: 4,
          },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textDim,
          tabBarLabelStyle: {
            fontFamily: PIXEL_FONT,
            fontSize: 9,
            letterSpacing: 1,
            textTransform: 'uppercase',
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <VideoCamera size={size} color={color} weight="duotone" />
            ),
          }}
        />
        <Tab.Screen
          name="Gallery"
          component={GalleryStackScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <SquaresFour size={size} color={color} weight="duotone" />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsStackScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <GearSix size={size} color={color} weight="duotone" />
            ),
          }}
        />
      </Tab.Navigator>
    </>
  );
}

export function AppNavigator() {
  const { state } = useConnection();

  if (state !== 'connected') {
    return <ConnectionScreen />;
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Main" component={MainTabs} />
    </RootStack.Navigator>
  );
}
```

- [ ] **Step 3: Verify navigation works**

Start the app and verify:
- 3 tabs visible: Home, Gallery, Settings
- Phosphor duotone icons render (camcorder, grid, gear)
- VT323 font used for tab labels
- Home shows the placeholder text
- Gallery and Settings still work

- [ ] **Step 4: Commit**

```bash
git add app/src/navigation/AppNavigator.tsx app/src/screens/HomeScreen.tsx
git commit -m "feat: restructure navigation to 3 tabs with Phosphor duotone icons"
```

---

## Task 9: App — Home StatusStrip + RuntimeEstimates

**Files:**
- Create: `app/src/components/home/StatusStrip.tsx`
- Create: `app/src/components/home/RuntimeEstimates.tsx`

- [ ] **Step 1: Create StatusStrip component**

Create `app/src/components/home/StatusStrip.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { HardDrives, Battery } from 'phosphor-react-native';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

interface Props {
  storageFreeGb: number;
  storagePct: number;
  batteryVoltage: number | null;
  batterySoc: number | null;
  storageWarning?: boolean;
}

export function StatusStrip({ storageFreeGb, storagePct, batteryVoltage, batterySoc, storageWarning }: Props) {
  const storageColor = storageWarning ? colors.danger : colors.textSecondary;
  const storageRemaining = Math.round(100 - storagePct);

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <HardDrives size={14} color={storageColor} weight="duotone" />
        <Text style={[styles.text, { color: storageColor }, glowStyle]}>
          {storageFreeGb.toFixed(1)}GB {storageRemaining}%
        </Text>
      </View>
      <View style={styles.right}>
        {batteryVoltage != null && (
          <Text style={[styles.text, glowStyle]}>{batteryVoltage.toFixed(1)}V</Text>
        )}
        <Battery size={14} color={colors.textSecondary} weight="duotone" />
        <Text style={[styles.text, glowStyle]}>
          {batterySoc != null ? `${Math.round(batterySoc)}%` : '--'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  text: {
    fontFamily: PIXEL_FONT,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
});
```

- [ ] **Step 2: Create RuntimeEstimates component**

Create `app/src/components/home/RuntimeEstimates.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

interface Props {
  bypassHours: number | null;
  bypassFrames: number | null;
  autoHours: number | null;
  autoFrames: number | null;
  bypassStorageLimited: boolean;
  autoStorageLimited: boolean;
}

export function RuntimeEstimates({
  bypassHours, bypassFrames,
  autoHours, autoFrames,
  bypassStorageLimited, autoStorageLimited,
}: Props) {
  const bypassColor = bypassStorageLimited ? colors.danger : colors.textSecondary;
  const autoColor = autoStorageLimited ? colors.danger : colors.textSecondary;

  const formatHours = (h: number | null) => h != null ? `${Math.round(h)}h` : '--';
  const formatFrames = (f: number | null) => {
    if (f == null) return '--';
    return f >= 1000 ? `${(f / 1000).toFixed(1)}k` : String(f);
  };

  return (
    <View style={styles.container}>
      <View style={styles.column}>
        <Text style={styles.modeLabel}>BYPASS</Text>
        <Text style={[styles.value, { color: bypassColor }, glowStyle]}>
          {formatHours(bypassHours)} · {formatFrames(bypassFrames)} frames
        </Text>
      </View>
      <View style={styles.column}>
        <Text style={[styles.modeLabel, { textAlign: 'right' }]}>AUTO</Text>
        <Text style={[styles.value, { color: autoColor, textAlign: 'right' }, glowStyle]}>
          {formatHours(autoHours)} · {formatFrames(autoFrames)} frames
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  column: { flex: 1 },
  modeLabel: {
    fontFamily: PIXEL_FONT,
    fontSize: 9,
    color: colors.textDim,
    letterSpacing: 1,
  },
  value: {
    fontFamily: PIXEL_FONT,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
```

- [ ] **Step 3: Commit**

```bash
mkdir -p app/src/components/home
git add app/src/components/home/StatusStrip.tsx app/src/components/home/RuntimeEstimates.tsx
git commit -m "feat: add StatusStrip and RuntimeEstimates components"
```

---

## Task 10: App — Home Viewfinder

**Files:**
- Create: `app/src/components/home/Viewfinder.tsx`

- [ ] **Step 1: Create Viewfinder component**

Create `app/src/components/home/Viewfinder.tsx`:

```typescript
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

interface Props {
  imageUri: string | null;
  mode: 'standby' | 'live' | 'recording';
  captureCount?: number;
}

export function Viewfinder({ imageUri, mode, captureCount }: Props) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      {/* Preview image or empty black */}
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
      ) : (
        <View style={styles.emptyFrame} />
      )}

      {/* Corner brackets */}
      <View style={[styles.bracket, styles.topLeft]} />
      <View style={[styles.bracket, styles.topRight]} />
      <View style={[styles.bracket, styles.bottomLeft]} />
      <View style={[styles.bracket, styles.bottomRight]} />

      {/* Center crosshair */}
      <View style={styles.crosshairH} />
      <View style={styles.crosshairV} />

      {/* Mode indicator — top left */}
      <View style={styles.modeOverlay}>
        {mode === 'recording' ? (
          <Text style={[styles.modeText, { color: colors.record }, glowStyle]}>
            REC {'\u25CF'} {captureCount ?? 0}
          </Text>
        ) : mode === 'live' ? (
          <Text style={[styles.modeText, glowStyle]}>LIVE {'\u25B7'}</Text>
        ) : (
          <Text style={[styles.modeText, { color: colors.textMuted }, glowStyle]}>STBY {'\u25B7'}</Text>
        )}
      </View>

      {/* Date stamp — bottom left */}
      <View style={styles.dateOverlay}>
        <Text style={[styles.overlayText, glowStyle]}>{dateStr}  {timeStr}</Text>
      </View>

      {/* Resolution — bottom right */}
      <View style={styles.resOverlay}>
        <Text style={[styles.overlayText, glowStyle]}>800x600</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: 4 / 3,
    backgroundColor: '#0a0a10',
    marginHorizontal: spacing.sm,
    marginVertical: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  emptyFrame: { flex: 1 },

  // Corner brackets
  bracket: { position: 'absolute', width: 20, height: 20 },
  topLeft: { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderColor: '#555' },
  topRight: { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#555' },
  bottomLeft: { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: '#555' },
  bottomRight: { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2, borderColor: '#555' },

  // Crosshair
  crosshairH: { position: 'absolute', top: '50%', left: '50%', width: 24, height: 1, marginLeft: -12, backgroundColor: '#444' },
  crosshairV: { position: 'absolute', top: '50%', left: '50%', width: 1, height: 24, marginTop: -12, backgroundColor: '#444' },

  // Overlays
  modeOverlay: { position: 'absolute', top: 12, left: 14 },
  modeText: { fontFamily: PIXEL_FONT, fontSize: 12, color: colors.text, letterSpacing: 1 },
  dateOverlay: { position: 'absolute', bottom: 12, left: 14 },
  resOverlay: { position: 'absolute', bottom: 12, right: 14 },
  overlayText: { fontFamily: PIXEL_FONT, fontSize: 10, color: '#777' },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/home/Viewfinder.tsx
git commit -m "feat: add Viewfinder component with VHS overlay brackets, crosshair, mode indicator"
```

---

## Task 11: App — Home PreviewControls

**Files:**
- Create: `app/src/components/home/PreviewControls.tsx`

- [ ] **Step 1: Create PreviewControls component**

Create `app/src/components/home/PreviewControls.tsx`:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera, VideoCamera } from 'phosphor-react-native';
import { colors, spacing, PIXEL_FONT } from '../../theme';

interface Props {
  livePreview: boolean;
  onToggleLive: () => void;
  onSnap: () => void;
  disabled?: boolean;
}

export function PreviewControls({ livePreview, onToggleLive, onSnap, disabled }: Props) {
  const disabledOpacity = disabled ? 0.3 : 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, { opacity: disabledOpacity }]}
        onPress={onSnap}
        disabled={disabled}
      >
        <View style={styles.circle}>
          <Camera size={20} color={colors.text} weight="duotone" />
        </View>
        <Text style={styles.label}>SNAP</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { opacity: disabledOpacity }]}
        onPress={onToggleLive}
        disabled={disabled}
      >
        <View style={[styles.circle, livePreview && styles.circleActive]}>
          <VideoCamera size={20} color={livePreview ? colors.success : colors.text} weight="duotone" />
        </View>
        <Text style={[styles.label, livePreview && { color: colors.success }]}>LIVE</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: spacing.sm,
  },
  button: { alignItems: 'center', gap: 4 },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleActive: { borderColor: colors.success },
  label: {
    fontFamily: PIXEL_FONT,
    fontSize: 9,
    color: colors.textDim,
    letterSpacing: 1,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/home/PreviewControls.tsx
git commit -m "feat: add PreviewControls component (Snap + Live toggle)"
```

---

## Task 12: App — Home CameraSettings

**Files:**
- Create: `app/src/components/home/CameraSettings.tsx`

- [ ] **Step 1: Create CameraSettings component**

Create `app/src/components/home/CameraSettings.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CaretDown } from 'phosphor-react-native';
import Slider from '@react-native-community/slider';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

interface CameraConfig {
  iso: number;
  exposure_mode: string;
  awb_mode: string;
  shutter_speed: number | null;
  ev_compensation: number;
  metering_mode: string;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  noise_reduction: string;
}

interface Props {
  camera: CameraConfig;
  onUpdate: (key: string, value: unknown) => void;
}

const ISO_VALUES = [100, 200, 400, 800, 1600, 3200];
const AWB_MODES = ['auto', 'daylight', 'cloudy', 'tungsten', 'fluorescent'];
const SHUTTER_SPEEDS = [
  { label: '1/1000', value: 1000 },
  { label: '1/500', value: 2000 },
  { label: '1/250', value: 4000 },
  { label: '1/125', value: 8000 },
  { label: '1/60', value: 16667 },
  { label: '1/30', value: 33333 },
  { label: '1/15', value: 66667 },
  { label: '1/8', value: 125000 },
  { label: '1/4', value: 250000 },
  { label: '1/2', value: 500000 },
  { label: '1s', value: 1000000 },
  { label: '2s', value: 2000000 },
  { label: '5s', value: 5000000 },
  { label: '10s', value: 10000000 },
];
const METERING_MODES = ['centre', 'spot', 'matrix'];
const NR_MODES = ['off', 'fast', 'high_quality', 'minimal'];

function Chip({ label, value, active, onPress }: { label: string; value: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipExpanded]} onPress={onPress}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={[styles.chipValue, glowStyle]}>{value}</Text>
      <CaretDown size={8} color={colors.textDim} weight="bold" />
    </TouchableOpacity>
  );
}

function DiscreteStrip({ options, selected, onSelect }: { options: Array<{ label: string; value: unknown }>; selected: unknown; onSelect: (v: unknown) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={styles.stripContent}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.label}
          style={[styles.stripItem, opt.value === selected && styles.stripItemActive]}
          onPress={() => onSelect(opt.value)}
        >
          <Text style={[styles.stripText, opt.value === selected && styles.stripTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function SliderStrip({ min, max, step, value, onValueChange, formatLabel }: { min: number; max: number; step: number; value: number; onValueChange: (v: number) => void; formatLabel?: (v: number) => string }) {
  const label = formatLabel ? formatLabel(value) : value.toFixed(1);
  return (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderValue}>{label}</Text>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        onSlidingComplete={onValueChange}
        minimumTrackTintColor={colors.textMuted}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.text}
      />
    </View>
  );
}

export function CameraSettings({ camera, onUpdate }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tier2Open, setTier2Open] = useState(false);

  const toggle = (key: string) => setExpanded(expanded === key ? null : key);

  const shutterLabel = () => {
    if (!camera.shutter_speed) return 'AUTO';
    const match = SHUTTER_SPEEDS.find(s => s.value === camera.shutter_speed);
    return match?.label ?? `${camera.shutter_speed}us`;
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>CAMERA</Text>

      {/* Tier 1 */}
      <View style={styles.chipRow}>
        <Chip label="ISO" value={String(camera.iso)} active={expanded === 'iso'} onPress={() => toggle('iso')} />
        <Chip label="EXP" value={camera.exposure_mode === 'auto' ? 'AUTO' : 'MAN'} active={expanded === 'exp'} onPress={() => toggle('exp')} />
        <Chip label="WB" value={camera.awb_mode.toUpperCase()} active={expanded === 'wb'} onPress={() => toggle('wb')} />
        <Chip label="EV" value={camera.ev_compensation >= 0 ? `+${camera.ev_compensation}` : String(camera.ev_compensation)} active={expanded === 'ev'} onPress={() => toggle('ev')} />
        {camera.exposure_mode === 'manual' && (
          <Chip label="SHTR" value={shutterLabel()} active={expanded === 'shtr'} onPress={() => toggle('shtr')} />
        )}
      </View>

      {/* Tier 1 inline strips */}
      {expanded === 'iso' && (
        <DiscreteStrip
          options={ISO_VALUES.map(v => ({ label: String(v), value: v }))}
          selected={camera.iso}
          onSelect={v => { onUpdate('iso', v); setExpanded(null); }}
        />
      )}
      {expanded === 'exp' && (
        <DiscreteStrip
          options={[{ label: 'AUTO', value: 'auto' }, { label: 'MANUAL', value: 'manual' }]}
          selected={camera.exposure_mode}
          onSelect={v => { onUpdate('exposure_mode', v); setExpanded(null); }}
        />
      )}
      {expanded === 'wb' && (
        <DiscreteStrip
          options={AWB_MODES.map(m => ({ label: m.toUpperCase(), value: m }))}
          selected={camera.awb_mode}
          onSelect={v => { onUpdate('awb_mode', v); setExpanded(null); }}
        />
      )}
      {expanded === 'ev' && (
        <SliderStrip min={-4} max={4} step={0.5} value={camera.ev_compensation} onValueChange={v => { onUpdate('ev_compensation', v); setExpanded(null); }} formatLabel={v => v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1)} />
      )}
      {expanded === 'shtr' && (
        <DiscreteStrip
          options={SHUTTER_SPEEDS.map(s => ({ label: s.label, value: s.value }))}
          selected={camera.shutter_speed}
          onSelect={v => { onUpdate('shutter_speed', v); setExpanded(null); }}
        />
      )}

      {/* Tier 2 toggle */}
      <TouchableOpacity style={styles.tier2Toggle} onPress={() => setTier2Open(!tier2Open)}>
        <Text style={styles.sectionHeader}>IMAGE</Text>
        <CaretDown size={10} color={colors.textDim} weight="bold" style={tier2Open ? { transform: [{ rotate: '180deg' }] } : undefined} />
      </TouchableOpacity>

      {tier2Open && (
        <>
          <View style={styles.chipRow}>
            <Chip label="SHRP" value={camera.sharpness.toFixed(1)} active={expanded === 'shrp'} onPress={() => toggle('shrp')} />
            <Chip label="CNTR" value={camera.contrast.toFixed(1)} active={expanded === 'cntr'} onPress={() => toggle('cntr')} />
            <Chip label="SAT" value={camera.saturation.toFixed(1)} active={expanded === 'sat'} onPress={() => toggle('sat')} />
            <Chip label="BRT" value={camera.brightness.toFixed(1)} active={expanded === 'brt'} onPress={() => toggle('brt')} />
          </View>
          <View style={styles.chipRow}>
            <Chip label="MTR" value={camera.metering_mode.toUpperCase()} active={expanded === 'mtr'} onPress={() => toggle('mtr')} />
            <Chip label="NR" value={camera.noise_reduction.toUpperCase().replace('_', ' ')} active={expanded === 'nr'} onPress={() => toggle('nr')} />
          </View>

          {expanded === 'shrp' && <SliderStrip min={0} max={16} step={0.5} value={camera.sharpness} onValueChange={v => { onUpdate('sharpness', v); setExpanded(null); }} />}
          {expanded === 'cntr' && <SliderStrip min={0} max={4} step={0.1} value={camera.contrast} onValueChange={v => { onUpdate('contrast', v); setExpanded(null); }} />}
          {expanded === 'sat' && <SliderStrip min={0} max={4} step={0.1} value={camera.saturation} onValueChange={v => { onUpdate('saturation', v); setExpanded(null); }} />}
          {expanded === 'brt' && <SliderStrip min={-1} max={1} step={0.1} value={camera.brightness} onValueChange={v => { onUpdate('brightness', v); setExpanded(null); }} />}
          {expanded === 'mtr' && (
            <DiscreteStrip options={METERING_MODES.map(m => ({ label: m.toUpperCase(), value: m }))} selected={camera.metering_mode} onSelect={v => { onUpdate('metering_mode', v); setExpanded(null); }} />
          )}
          {expanded === 'nr' && (
            <DiscreteStrip options={NR_MODES.map(m => ({ label: m.toUpperCase().replace('_', ' '), value: m }))} selected={camera.noise_reduction} onSelect={v => { onUpdate('noise_reduction', v); setExpanded(null); }} />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  sectionHeader: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textDim, letterSpacing: 2, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 4,
  },
  chipExpanded: { borderColor: colors.textMuted },
  chipLabel: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  chipValue: { fontSize: 11, color: colors.text },
  strip: { marginBottom: spacing.sm },
  stripContent: { gap: spacing.xs, paddingVertical: spacing.xs },
  stripItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },
  stripItemActive: { borderColor: colors.text, backgroundColor: colors.surfaceLight },
  stripText: { fontFamily: PIXEL_FONT, fontSize: 10, color: colors.textMuted },
  stripTextActive: { color: colors.text },
  sliderContainer: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.sm },
  sliderValue: { fontFamily: PIXEL_FONT, fontSize: 11, color: colors.text, width: 40, textAlign: 'center' },
  slider: { flex: 1, height: 30 },
  tier2Toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm, marginBottom: spacing.xs },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/home/CameraSettings.tsx
git commit -m "feat: add CameraSettings component with Tier 1/2 chips, inline strips, and sliders"
```

---

## Task 13: App — Home CaptureSettings

**Files:**
- Create: `app/src/components/home/CaptureSettings.tsx`

- [ ] **Step 1: Create CaptureSettings component**

Create `app/src/components/home/CaptureSettings.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { Clock, Sun, SunHorizon } from 'phosphor-react-native';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

interface Props {
  softwareInterval: number;
  hardwareInterval: number;
  daylightOnly: boolean;
  sunriseOffset?: number;
  sunsetOffset?: number;
  windowStart?: string;
  windowEnd?: string;
  onUpdate: (key: string, value: unknown) => void;
}

function EditableValue({ value, onSubmit, suffix, minValue }: { value: number; onSubmit: (v: number) => void; suffix: string; minValue?: number }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(value));

  const handleSubmit = () => {
    const num = parseInt(text, 10);
    if (!isNaN(num) && (!minValue || num >= minValue)) {
      onSubmit(num);
    } else {
      setText(String(value));
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <TextInput
        style={styles.editInput}
        value={text}
        onChangeText={setText}
        onBlur={handleSubmit}
        onSubmitEditing={handleSubmit}
        keyboardType="numeric"
        autoFocus
        selectTextOnFocus
      />
    );
  }

  return (
    <TouchableOpacity onPress={() => { setText(String(value)); setEditing(true); }}>
      <Text style={[styles.settingValue, glowStyle]}>{value}{suffix}</Text>
    </TouchableOpacity>
  );
}

function OffsetInput({ value, onSubmit }: { value: number; onSubmit: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(Math.abs(value)));

  const handleSubmit = () => {
    const num = parseInt(text, 10);
    if (!isNaN(num)) {
      // Keep the sign from the display prefix
      onSubmit(value >= 0 ? num : -num);
    }
    setEditing(false);
  };

  const toggleSign = () => onSubmit(-value);

  if (editing) {
    return (
      <TextInput
        style={styles.editInput}
        value={text}
        onChangeText={setText}
        onBlur={handleSubmit}
        onSubmitEditing={handleSubmit}
        keyboardType="numeric"
        autoFocus
        selectTextOnFocus
      />
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <TouchableOpacity onPress={toggleSign}>
        <Text style={[styles.settingValue, { color: colors.textMuted }]}>{value >= 0 ? '+' : '-'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => { setText(String(Math.abs(value))); setEditing(true); }}>
        <Text style={[styles.settingValue, glowStyle]}>{Math.abs(value)}m</Text>
      </TouchableOpacity>
    </View>
  );
}

export function CaptureSettings({ softwareInterval, hardwareInterval, daylightOnly, sunriseOffset = 0, sunsetOffset = 0, windowStart = '06:00', windowEnd = '20:00', onUpdate }: Props) {
  const hwMinutes = Math.round(hardwareInterval / 60);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>CAPTURE</Text>

      <View style={styles.row}>
        {/* Software interval */}
        <View style={styles.setting}>
          <Clock size={14} color={colors.textMuted} weight="duotone" />
          <EditableValue value={softwareInterval} onSubmit={v => onUpdate('software_interval_sec', v)} suffix="s" />
        </View>

        <View style={styles.divider} />

        {/* Hardware interval */}
        <View style={styles.setting}>
          <Clock size={14} color={colors.textMuted} weight="duotone" />
          <Text style={styles.hwLabel}>HW</Text>
          <EditableValue value={hwMinutes} onSubmit={v => onUpdate('hardware_interval_sec', v * 60)} suffix="m" minValue={1} />
        </View>

        <View style={styles.divider} />

        {/* Daylight toggle */}
        <View style={styles.setting}>
          <Sun size={14} color={colors.textMuted} weight="duotone" />
          <Text style={[styles.settingLabel, daylightOnly && { color: colors.success }]}>DAYLIGHT</Text>
          <Switch
            value={daylightOnly}
            onValueChange={v => onUpdate('daylight_only', v)}
            trackColor={{ false: colors.border, true: colors.successBg }}
            thumbColor={daylightOnly ? colors.success : colors.textMuted}
            style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }}
          />
        </View>
      </View>

      {/* Sunrise/sunset offsets OR start/end times */}
      {daylightOnly ? (
        <View style={[styles.row, { marginTop: spacing.xs }]}>
          <View style={styles.setting}>
            <SunHorizon size={14} color={colors.textMuted} weight="duotone" />
            <OffsetInput value={sunriseOffset} onSubmit={v => onUpdate('sunrise_offset_min', v)} />
          </View>
          <View style={styles.divider} />
          <View style={styles.setting}>
            <SunHorizon size={14} color={colors.textMuted} weight="duotone" style={{ transform: [{ scaleY: -1 }] }} />
            <OffsetInput value={sunsetOffset} onSubmit={v => onUpdate('sunset_offset_min', v)} />
          </View>
        </View>
      ) : (
        <View style={[styles.row, { marginTop: spacing.xs }]}>
          <View style={styles.setting}>
            <Clock size={14} color={colors.textMuted} weight="duotone" />
            <TouchableOpacity>
              <Text style={[styles.settingValue, glowStyle]}>{windowStart}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <View style={styles.setting}>
            <Clock size={14} color={colors.textMuted} weight="duotone" />
            <TouchableOpacity>
              <Text style={[styles.settingValue, glowStyle]}>{windowEnd}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  sectionHeader: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textDim, letterSpacing: 2, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingLabel: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  settingValue: { fontSize: 11, color: colors.text },
  hwLabel: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textMuted, letterSpacing: 1 },
  divider: { width: 1, height: 14, backgroundColor: colors.borderLight },
  editInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 11,
    minWidth: 40,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/home/CaptureSettings.tsx
git commit -m "feat: add CaptureSettings component (intervals, daylight, sunrise/sunset offsets)"
```

---

## Task 14: App — Home CaptureControls

**Files:**
- Create: `app/src/components/home/CaptureControls.tsx`

- [ ] **Step 1: Create CaptureControls component**

Create `app/src/components/home/CaptureControls.tsx`:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera, Stop } from 'phosphor-react-native';
import { colors, spacing, recordGlowStyle, PIXEL_FONT } from '../../theme';

interface Props {
  isRecording: boolean;
  onCapture: () => void;
  onRecord: () => void;
  onStop: () => void;
  captureDisabled?: boolean;
}

export function CaptureControls({ isRecording, onCapture, onRecord, onStop, captureDisabled }: Props) {
  return (
    <View style={styles.container}>
      {/* Capture Still */}
      <TouchableOpacity
        style={[styles.buttonWrap, (isRecording || captureDisabled) && styles.disabled]}
        onPress={onCapture}
        disabled={isRecording || captureDisabled}
      >
        <View style={styles.captureCircle}>
          <Camera size={22} color={colors.text} weight="duotone" />
        </View>
        <Text style={styles.label}>CAPTURE</Text>
      </TouchableOpacity>

      {/* Record / Stop */}
      {isRecording ? (
        <TouchableOpacity style={styles.buttonWrap} onPress={onStop}>
          <View style={styles.stopCircle}>
            <Stop size={22} color={colors.text} weight="duotone" />
          </View>
          <Text style={[styles.label, { color: colors.textMuted }]}>STOP</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.buttonWrap} onPress={onRecord}>
          <View style={[styles.recordCircle, recordGlowStyle]}>
            <View style={styles.recordDot} />
          </View>
          <Text style={[styles.label, { color: colors.record }]}>{'\u25CF'} REC</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
  buttonWrap: { alignItems: 'center', gap: 4 },
  disabled: { opacity: 0.3 },
  captureCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: colors.record,
    backgroundColor: colors.recordBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.record,
  },
  stopCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: colors.textMuted,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontFamily: PIXEL_FONT,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/home/CaptureControls.tsx
git commit -m "feat: add CaptureControls component (Capture Still + Record/Stop)"
```

---

## Task 15: App — Assemble HomeScreen

**Files:**
- Modify: `app/src/screens/HomeScreen.tsx`

- [ ] **Step 1: Wire all home components together**

Replace the entire contents of `app/src/screens/HomeScreen.tsx`:

```typescript
import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useStatus } from '../hooks/useStatus';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { usePreview } from '../hooks/usePreview';
import { useCaptureNow, useStartCaptureLoop, useStopCaptureLoop } from '../hooks/useCapture';
import { useConnection } from '../providers/ConnectionProvider';
import { StatusStrip } from '../components/home/StatusStrip';
import { RuntimeEstimates } from '../components/home/RuntimeEstimates';
import { Viewfinder } from '../components/home/Viewfinder';
import { PreviewControls } from '../components/home/PreviewControls';
import { CameraSettings } from '../components/home/CameraSettings';
import { CaptureSettings } from '../components/home/CaptureSettings';
import { CaptureControls } from '../components/home/CaptureControls';
import { colors, spacing } from '../theme';

const DEFAULT_CAMERA = {
  iso: 100, exposure_mode: 'auto', awb_mode: 'auto', shutter_speed: null,
  ev_compensation: 0, metering_mode: 'centre', brightness: 0, contrast: 1,
  saturation: 1, sharpness: 1, noise_reduction: 'off',
};

export function HomeScreen() {
  const isFocused = useIsFocused();
  const { lastStatus } = useConnection();
  const { data: status } = useStatus();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const captureNow = useCaptureNow();
  const startLoop = useStartCaptureLoop();
  const stopLoop = useStopCaptureLoop();

  const [livePreview, setLivePreview] = useState(false);
  const s = status || lastStatus;
  const isRecording = s?.capture_state === 'running';

  // Preview: live polling when toggled on, or show latest capture frame when recording
  const previewActive = isFocused && livePreview && !isRecording;
  const imageUri = usePreview(previewActive);

  // Camera config with defaults
  const camera = { ...DEFAULT_CAMERA, ...(settings as any)?.camera };

  const updateCamera = useCallback((key: string, value: unknown) => {
    updateSettings.mutate({ camera: { [key]: value } });
  }, [updateSettings]);

  const updateSetting = useCallback((key: string, value: unknown) => {
    // Handle nested keys like 'location.lat'
    const keys = key.split('.');
    if (keys.length === 1) {
      updateSettings.mutate({ [key]: value });
    } else {
      const update: any = {};
      let current = update;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      updateSettings.mutate(update);
    }
  }, [updateSettings]);

  if (!s) return null;

  // Compute runtime estimates
  const storageFreeGb = s.storage_free_mb / 1024;
  const swInterval = (settings as any)?.software_interval_sec ?? s.software_interval_sec;
  const hwInterval = (settings as any)?.hardware_interval_sec ?? s.hardware_interval_sec;

  // Rough estimates: frames = hours * 3600 / interval
  const bypassHours = s.runtime_estimate_hours;
  const bypassFrames = bypassHours != null ? Math.round(bypassHours * 3600 / Math.max(swInterval, 1)) : null;

  // AUTO estimate: much longer runtime due to duty cycling
  // Approximate: auto_hours ~ bypass_hours * (hw_interval / on_time)
  const autoHours = bypassHours != null ? Math.round(bypassHours * hwInterval / 25) : null;
  const autoFrames = autoHours != null ? Math.round(autoHours * 3600 / Math.max(hwInterval, 1)) : null;

  // Rough storage limit: assume ~4MB per image
  const avgImageMb = 4;
  const framesUntilFull = Math.round(s.storage_free_mb / avgImageMb);
  const bypassStorageLimited = bypassFrames != null && bypassFrames > framesUntilFull;
  const autoStorageLimited = autoFrames != null && autoFrames > framesUntilFull;

  const viewfinderMode = isRecording ? 'recording' : livePreview ? 'live' : 'standby';

  // When recording, show the latest capture frame
  const displayUri = isRecording && s.last_capture
    ? `${(settings as any)?._baseUrl || ''}` // handled by preview hook
    : imageUri;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <StatusStrip
        storageFreeGb={storageFreeGb}
        storagePct={s.storage_used_pct}
        batteryVoltage={s.battery_voltage}
        batterySoc={s.battery_soc_pct}
        storageWarning={bypassStorageLimited || autoStorageLimited}
      />

      <RuntimeEstimates
        bypassHours={bypassHours}
        bypassFrames={bypassFrames}
        autoHours={autoHours}
        autoFrames={autoFrames}
        bypassStorageLimited={bypassStorageLimited}
        autoStorageLimited={autoStorageLimited}
      />

      <Viewfinder
        imageUri={imageUri}
        mode={viewfinderMode}
        captureCount={s.capture_count}
      />

      <PreviewControls
        livePreview={livePreview}
        onToggleLive={() => setLivePreview(!livePreview)}
        onSnap={() => {
          // Fetch a single preview frame
          setLivePreview(true);
          setTimeout(() => setLivePreview(false), 1500);
        }}
        disabled={isRecording}
      />

      <View style={styles.divider} />

      <CameraSettings camera={camera} onUpdate={updateCamera} />

      <View style={styles.divider} />

      <CaptureSettings
        softwareInterval={swInterval}
        hardwareInterval={hwInterval}
        daylightOnly={(settings as any)?.daylight_only ?? false}
        sunriseOffset={(settings as any)?.sunrise_offset_min ?? 0}
        sunsetOffset={(settings as any)?.sunset_offset_min ?? 0}
        windowStart={(settings as any)?.window_start ?? '06:00'}
        windowEnd={(settings as any)?.window_end ?? '20:00'}
        onUpdate={updateSetting}
      />

      <View style={styles.divider} />

      <CaptureControls
        isRecording={isRecording}
        onCapture={() => captureNow.mutate()}
        onRecord={() => startLoop.mutate(swInterval)}
        onStop={() => stopLoop.mutate()}
        captureDisabled={captureNow.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md, marginVertical: spacing.xs },
});
```

- [ ] **Step 2: Verify HomeScreen renders**

Start the app, navigate to Home tab. Verify:
- Status bar shows storage + battery info
- Runtime estimates row visible
- Viewfinder with corner brackets, crosshair, STBY indicator, date stamp
- Snap/Live preview controls
- Camera settings chips (ISO, EXP, WB, EV)
- Capture settings (intervals, daylight toggle)
- Capture/Record buttons at bottom

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/HomeScreen.tsx
git commit -m "feat: assemble HomeScreen with all sub-components"
```

---

## Task 16: App — Slim Down Settings + GPS Location

**Files:**
- Modify: `app/src/screens/settings/SettingsScreen.tsx`

- [ ] **Step 1: Rewrite SettingsScreen with Location, Device, Network only**

Replace the entire contents of `app/src/screens/settings/SettingsScreen.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MapPin, Crosshair, Battery as BatteryIcon, WifiHigh } from 'phosphor-react-native';
import * as Location from 'expo-location';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { colors, spacing, glowStyle, PIXEL_FONT } from '../../theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SettingRow({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabelWrap}>
        {icon}
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

export function SettingsScreen({ navigation }: any) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [localSettings, setLocalSettings] = useState<any>(null);

  useEffect(() => {
    if (settings && !localSettings) setLocalSettings(settings);
  }, [settings, localSettings]);

  if (!localSettings) return null;

  const save = (path: string, value: unknown) => {
    const keys = path.split('.');
    const update: any = {};
    let current = update;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    updateSettings.mutate(update);

    const newLocal = JSON.parse(JSON.stringify(localSettings));
    let ref = newLocal;
    for (let i = 0; i < keys.length - 1; i++) ref = ref[keys[i]];
    ref[keys[keys.length - 1]] = value;
    setLocalSettings(newLocal);
  };

  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      save('location.lat', Math.round(loc.coords.latitude * 10000) / 10000);
      save('location.lon', Math.round(loc.coords.longitude * 10000) / 10000);
    } catch (e: any) {
      Alert.alert('Location Error', e.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>SETTINGS</Text>

      <Section title="LOCATION">
        <SettingRow label="Latitude" icon={<MapPin size={16} color={colors.textMuted} weight="duotone" />}>
          <TextInput
            style={styles.input}
            value={String(localSettings.location?.lat ?? 0)}
            onChangeText={v => save('location.lat', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
          />
        </SettingRow>
        <SettingRow label="Longitude" icon={<MapPin size={16} color={colors.textMuted} weight="duotone" />}>
          <TextInput
            style={styles.input}
            value={String(localSettings.location?.lon ?? 0)}
            onChangeText={v => save('location.lon', parseFloat(v) || 0)}
            keyboardType="decimal-pad"
          />
        </SettingRow>
        <TouchableOpacity style={styles.gpsButton} onPress={useCurrentLocation}>
          <Crosshair size={16} color={colors.text} weight="duotone" />
          <Text style={styles.gpsButtonText}>Use Current Location</Text>
        </TouchableOpacity>
      </Section>

      <Section title="DEVICE">
        <SettingRow label="Battery (mAh)" icon={<BatteryIcon size={16} color={colors.textMuted} weight="duotone" />}>
          <TextInput
            style={styles.input}
            value={String(localSettings.power?.battery_mah ?? localSettings.battery_mah ?? 9700)}
            onChangeText={v => save('power.battery_mah', parseInt(v, 10) || 0)}
            keyboardType="numeric"
          />
        </SettingRow>
      </Section>

      <Section title="NETWORK">
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('Network')}>
          <WifiHigh size={18} color={colors.text} weight="duotone" />
          <Text style={styles.navButtonText}>WiFi Management</Text>
        </TouchableOpacity>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  title: { fontFamily: PIXEL_FONT, fontSize: 18, color: colors.text, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionTitle: { fontFamily: PIXEL_FONT, fontSize: 9, color: colors.textDim, letterSpacing: 2, marginBottom: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  rowLabel: { fontSize: 14, color: colors.text },
  input: { backgroundColor: colors.surfaceLight, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 4, textAlign: 'right', width: 100, borderWidth: 1, borderColor: colors.border },
  gpsButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceLight, padding: spacing.md, borderRadius: 4, marginTop: spacing.md, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  gpsButtonText: { color: colors.text, fontSize: 14 },
  navButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceLight, padding: spacing.md, borderRadius: 4, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  navButtonText: { color: colors.text, fontWeight: '500', fontSize: 15 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/screens/settings/SettingsScreen.tsx
git commit -m "feat: slim Settings to Location (with GPS), Device, Network; restyle to Hi8"
```

---

## Task 17: App — Update NetworkScreen (Add Network + Restyle)

**Files:**
- Modify: `app/src/screens/settings/NetworkScreen.tsx`

- [ ] **Step 1: Add manual network entry and restyle**

In `app/src/screens/settings/NetworkScreen.tsx`, make these changes:

1. Add Phosphor icon imports at the top:
```typescript
import { ArrowLeft, MagnifyingGlass, WifiHigh, Plus, Trash } from 'phosphor-react-native';
```

2. Add state for manual network entry after the existing state declarations:
```typescript
const [showAddManual, setShowAddManual] = useState(false);
const [manualSsid, setManualSsid] = useState('');
const [manualPassword, setManualPassword] = useState('');
```

3. Add a manual connect handler after `handleConnect`:
```typescript
const handleManualConnect = () => {
  if (!manualSsid.trim()) return;
  wifiConnect.mutate({ ssid: manualSsid.trim(), password: manualPassword });
  Alert.alert('Connecting', `Connecting to ${manualSsid}...`);
  setShowAddManual(false);
  setManualSsid('');
  setManualPassword('');
};
```

4. Add a manual network entry section after the saved networks section (before the AP Mode button):
```typescript
{/* Add network manually */}
<View style={styles.section}>
  <View style={styles.sectionHeader}>
    <Text style={styles.label}>ADD NETWORK</Text>
  </View>
  {!showAddManual ? (
    <TouchableOpacity style={styles.addButton} onPress={() => setShowAddManual(true)}>
      <Plus size={16} color={colors.text} weight="duotone" />
      <Text style={styles.addButtonText}>Add Network Manually</Text>
    </TouchableOpacity>
  ) : (
    <View style={styles.manualForm}>
      <TextInput
        style={styles.input}
        placeholder="Network SSID"
        placeholderTextColor={colors.textMuted}
        value={manualSsid}
        onChangeText={setManualSsid}
        autoFocus
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        value={manualPassword}
        onChangeText={setManualPassword}
        secureTextEntry
      />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TouchableOpacity style={[styles.connectBtn, { flex: 1 }]} onPress={handleManualConnect}>
          <Text style={styles.connectBtnText}>Connect</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.connectBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAddManual(false)}>
          <Text style={[styles.connectBtnText, { color: colors.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  )}
</View>
```

5. Update all color references in the StyleSheet from the old palette to the Hi8 palette:
- Replace `colors.primary` with `colors.text` or `colors.accent` for button text
- Replace `colors.error` with `colors.danger` for remove buttons
- Replace `colors.warning` with `colors.warning` (same) for AP mode button
- Update backgrounds to use `colors.surface`, `colors.surfaceLight`, `colors.background`
- Update borders to use `colors.border`
- Update text to use `colors.text`, `colors.textMuted`, `colors.textSecondary`
- Add section header label style: `fontFamily: PIXEL_FONT`
- Add these new styles:
```typescript
addButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceLight, padding: spacing.md, borderRadius: 4, justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
addButtonText: { color: colors.text, fontSize: 14 },
manualForm: { gap: spacing.sm },
```

- [ ] **Step 2: Commit**

```bash
git add app/src/screens/settings/NetworkScreen.tsx
git commit -m "feat: add manual network entry to NetworkScreen, restyle to Hi8"
```

---

## Task 18: App — Restyle Gallery Screens

**Files:**
- Modify: `app/src/screens/gallery/BatchListScreen.tsx`
- Modify: `app/src/screens/gallery/BatchDetailScreen.tsx`
- Modify: `app/src/screens/gallery/ImageViewerScreen.tsx`
- Modify: `app/src/screens/render/RenderModal.tsx`
- Modify: `app/src/components/BatchCard.tsx`
- Modify: `app/src/components/ImageThumbnail.tsx`

- [ ] **Step 1: Restyle all gallery components**

For each file, update the StyleSheet color references from the old palette to Hi8:

**Common changes across all files:**
- `colors.background` stays (but now resolves to `#0d0d14`)
- `colors.surface` stays (now `#111118`)
- `colors.primary` → `colors.accent` for buttons, or `colors.text` for text
- `colors.error` → `colors.danger`
- `colors.textMuted` stays (now `#666666`)
- `colors.textSecondary` stays (now `#999999`)
- Title fonts: add `fontFamily: PIXEL_FONT` to title styles
- Section labels: add `fontFamily: PIXEL_FONT` to label styles
- Import `PIXEL_FONT` from theme in each file

**BatchListScreen.tsx:**
- Add `import { PIXEL_FONT } from '../../theme';`
- Update `title` style: add `fontFamily: PIXEL_FONT`

**BatchDetailScreen.tsx:**
- Add `import { PIXEL_FONT } from '../../theme';`
- Update `title` style: add `fontFamily: PIXEL_FONT`
- Replace `'← Back'` with just `'BACK'`, add `fontFamily: PIXEL_FONT` to `back` style
- Update action button colors: `downloadBtn` → `backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border`
- Update `deleteBtn` → `backgroundColor: colors.danger`

**ImageViewerScreen.tsx:**
- Replace `'✕'` close button text with Phosphor `X` icon: `import { X } from 'phosphor-react-native';` then use `<X size={18} color="#fff" weight="bold" />`

**RenderModal.tsx:**
- Add `import { PIXEL_FONT } from '../../theme';`
- Update title and label styles with `fontFamily: PIXEL_FONT`
- Update button colors from `colors.primary` to `colors.surfaceLight` with border
- Update slider colors: `minimumTrackTintColor: colors.textMuted`, `thumbTintColor: colors.text`

**BatchCard.tsx:**
- Add `import { PIXEL_FONT } from '../../theme';`
- Add `fontFamily: PIXEL_FONT` to the `name` style

**ImageThumbnail.tsx:**
- Update `colors.primary` → `colors.accent` for selected border

- [ ] **Step 2: Commit**

```bash
git add app/src/screens/gallery/ app/src/screens/render/ app/src/components/BatchCard.tsx app/src/components/ImageThumbnail.tsx
git commit -m "style: restyle Gallery screens and components to Hi8 palette"
```

---

## Task 19: App — Restyle ConnectionBar + ConnectionScreen

**Files:**
- Modify: `app/src/components/ConnectionBar.tsx`
- Modify: `app/src/screens/ConnectionScreen.tsx`

- [ ] **Step 1: Restyle ConnectionBar**

In `app/src/components/ConnectionBar.tsx`:
- Import `PIXEL_FONT` from theme
- Update `connected` background: `backgroundColor: 'rgba(74, 153, 104, 0.1)'` (success tint)
- Update `disconnected` background: `backgroundColor: 'rgba(204, 51, 51, 0.1)'` (record/danger tint)
- Update `dot` color: `backgroundColor: colors.success`
- Update `dotRed` color: `backgroundColor: colors.danger`
- Update text style: `fontFamily: PIXEL_FONT, fontSize: 11`
- Update address style: `fontFamily: PIXEL_FONT, fontSize: 10`

- [ ] **Step 2: Restyle ConnectionScreen**

In `app/src/screens/ConnectionScreen.tsx`:
- Import `{ PIXEL_FONT, glowStyle }` from theme
- Update `title` style: `fontFamily: PIXEL_FONT, fontSize: 28` and add `...glowStyle`
- Update `button` style: `backgroundColor: colors.surfaceLight, borderWidth: 1, borderColor: colors.border`
- Update `buttonText` color: `color: colors.text`
- Update `linkText`: `color: colors.textMuted`
- Update `input` border: add `borderWidth: 1, borderColor: colors.border`
- Update ActivityIndicator color: `color={colors.text}`

- [ ] **Step 3: Commit**

```bash
git add app/src/components/ConnectionBar.tsx app/src/screens/ConnectionScreen.tsx
git commit -m "style: restyle ConnectionBar and ConnectionScreen to Hi8 palette"
```

---

## Task 20: Cleanup — Delete Old Screens

**Files:**
- Delete: `app/src/screens/DashboardScreen.tsx`
- Delete: `app/src/screens/PreviewScreen.tsx`

- [ ] **Step 1: Delete old screen files**

```bash
rm app/src/screens/DashboardScreen.tsx app/src/screens/PreviewScreen.tsx
```

- [ ] **Step 2: Verify no remaining imports**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/app
grep -r "DashboardScreen\|PreviewScreen" src/ --include="*.tsx" --include="*.ts"
```

Expected: No results (AppNavigator.tsx already updated in Task 8 to not import these).

- [ ] **Step 3: Verify app builds and runs**

```bash
cd /mnt/c/Users/jake9/repos/timelapse-pi/app && npx expo start
```

Verify all 3 tabs work, Home screen renders, Gallery and Settings functional.

- [ ] **Step 4: Commit**

```bash
git add -A app/src/screens/
git commit -m "chore: delete DashboardScreen and PreviewScreen (replaced by HomeScreen)"
```

---

## Summary

| Task | Description | Dependencies |
|------|-------------|--------------|
| 1 | Backend: Config defaults | None |
| 2 | Backend: Camera control mappings | 1 |
| 3 | Backend: Auto-apply settings | 2 |
| 4 | App: Install dependencies | None |
| 5 | App: Rewrite theme | None |
| 6 | App: Font loading | 4, 5 |
| 7 | App: Update API types | None |
| 8 | App: Navigation restructure | 4, 5, 6 |
| 9 | App: StatusStrip + RuntimeEstimates | 5 |
| 10 | App: Viewfinder | 5 |
| 11 | App: PreviewControls | 5 |
| 12 | App: CameraSettings | 5 |
| 13 | App: CaptureSettings | 5 |
| 14 | App: CaptureControls | 5 |
| 15 | App: Assemble HomeScreen | 8-14 |
| 16 | App: Slim Settings + GPS | 5, 8 |
| 17 | App: NetworkScreen updates | 5 |
| 18 | App: Gallery restyle | 5 |
| 19 | App: Connection restyle | 5 |
| 20 | Cleanup: Delete old screens | 8, 15 |

**Parallelizable groups:**
- Tasks 1-3 (backend) can run in parallel with Tasks 4-7 (app foundation)
- Tasks 9-14 (home sub-components) can all run in parallel
- Tasks 16-19 (settings, network, gallery, connection restyle) can all run in parallel
