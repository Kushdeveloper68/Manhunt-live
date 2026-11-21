import { create } from 'zustand';

interface ConnectionState {
  connected: boolean;
  /** current reconnect attempt number (0 when none) */
  attempt: number;
  /** socket.io gave up reconnecting automatically */
  failed: boolean;
  /** last connection error text, for the "can't reach server" screen */
  lastError: string | null;
  setError: (message: string) => void;
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
  lastError: null,
  setError: (lastError) => set({ lastError }),
  setConnected: () => set({ connected: true, attempt: 0, failed: false, lastError: null }),
  setDisconnected: () => set({ connected: false }),
  setAttempt: (attempt) => set({ connected: false, attempt }),
  setFailed: () => set({ connected: false, failed: true }),
}));
