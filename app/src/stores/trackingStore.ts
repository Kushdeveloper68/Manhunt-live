import { create } from 'zustand';

export type TrackingMode = 'off' | 'background' | 'foreground';

interface TrackingState {
  /**
   * background: a foreground service keeps GPS running with the screen locked
   * foreground: GPS only runs while the app is open (background permission missing)
   */
  mode: TrackingMode;
  setMode: (mode: TrackingMode) => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  mode: 'off',
  setMode: (mode) => set({ mode }),
}));
