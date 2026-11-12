import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const KEY = 'manhunt_settings';

interface Settings {
  /** Faster, more accurate GPS (uses more battery). Ignored while low-battery mode is on. */
  highPrecisionGps: boolean;
  /** Slower GPS updates to stretch the battery. */
  lowBatteryMode: boolean;
  /** Vibrate when you get close to the zone boundary. */
  geofenceHaptics: boolean;
}

interface SettingsState extends Settings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const DEFAULTS: Settings = {
  highPrecisionGps: true,
  lowBatteryMode: false,
  geofenceHaptics: true,
};

const pick = (s: SettingsState): Settings => ({
  highPrecisionGps: s.highPrecisionGps,
  lowBatteryMode: s.lowBatteryMode,
  geofenceHaptics: s.geofenceHaptics,
});

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (raw) set({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch {
      /* use defaults */
    }
    set({ hydrated: true });
  },

  setSetting: (key, value) => {
    set({ [key]: value } as Partial<SettingsState>);
    SecureStore.setItemAsync(KEY, JSON.stringify(pick(get()))).catch(() => {});
  },
}));
