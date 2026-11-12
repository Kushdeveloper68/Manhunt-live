import { create } from 'zustand';

interface ConnectionState {
  connected: boolean;
  /** current reconnect attempt number (0 when none) */
  attempt: number;
  /** socket.io gave up reconnecting automatically */
  failed: boolean;
  setConnected: () => void;
  setDisconnected: () => void;
  setAttempt: (n: number) => void;
  setFailed: () => void;
}

export const MAX_RECONNECT_ATTEMPTS = 10;

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: true,
  attempt: 0,
  failed: false,
  setConnected: () => set({ connected: true, attempt: 0, failed: false }),
  setDisconnected: () => set({ connected: false }),
  setAttempt: (attempt) => set({ connected: false, attempt }),
  setFailed: () => set({ connected: false, failed: true }),
}));
