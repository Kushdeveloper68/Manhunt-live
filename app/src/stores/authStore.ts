import { create } from 'zustand';
import { UserProfile } from '@manhunt/shared';
import { api } from '../services/api';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  setAuth: (token: string, user: UserProfile) => void;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  loginGoogle: (googleId: string, email: string, username?: string) => Promise<void>;
  updateProfile: (data: {
    username?: string;
    avatarId?: string;
    dob?: string;
    emergencyContact?: { name: string; phone: string };
  }) => Promise<void>;
  checkUsername: (username: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,

  setAuth: (token: string, user: UserProfile) => {
    api.setToken(token);
    set({ token, user, isAuthenticated: true, error: null });
  },

  clearAuth: () => {
    api.setToken(null);
    set({ token: null, user: null, isAuthenticated: false, error: null });
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.login({ email, password });
      get().setAuth(res.token, res.user);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Login failed' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email: string, password: string, username: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.register({ email, password, username });
      get().setAuth(res.token, res.user);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Registration failed' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  loginGoogle: async (googleId: string, email: string, username?: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.googleAuth({ googleId, email, username });
      get().setAuth(res.token, res.user);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Google sign-in failed' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.updateProfile(data);
      set({ user: res.user });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Profile update failed' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  checkUsername: async (username: string) => {
    try {
      const res = await api.checkUsername(username);
      return res.available;
    } catch (_err) {
      return false;
    }
  },

  logout: () => {
    get().clearAuth();
  },
}));
