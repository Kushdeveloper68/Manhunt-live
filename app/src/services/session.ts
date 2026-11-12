import * as SecureStore from 'expo-secure-store';
import type { UserProfile } from '@manhunt/shared';

const TOKEN_KEY = 'manhunt_token';
const USER_KEY = 'manhunt_user';

/** Keeps the login across app restarts (token in the OS keystore). Never throws. */
export async function saveSession(token: string, user: UserProfile): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } catch {
    /* storage unavailable: user simply logs in again next launch */
  }
}

export async function loadSession(): Promise<{ token: string; user: UserProfile } | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const rawUser = await SecureStore.getItemAsync(USER_KEY);
    if (!token || !rawUser) return null;
    return { token, user: JSON.parse(rawUser) as UserProfile };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    /* ignore */
  }
}
