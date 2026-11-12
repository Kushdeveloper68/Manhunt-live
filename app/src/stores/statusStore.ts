import { create } from 'zustand';

export type NoticeType = 'CANCELLED' | 'KICKED';

interface StatusState {
  /** A full-screen system notice the root layout should show (match cancelled, removed from lobby...). */
  notice: { type: NoticeType; message: string } | null;
  setNotice: (type: NoticeType, message: string) => void;
  clearNotice: () => void;
}

export const useStatusStore = create<StatusState>((set) => ({
  notice: null,
  setNotice: (type, message) => set({ notice: { type, message } }),
  clearNotice: () => set({ notice: null }),
}));
