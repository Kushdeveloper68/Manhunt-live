import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api';

/**
 * Registers this device for push notifications and tells the server.
 * Loaded lazily and fully guarded: push is a nice-to-have and must never break the app
 * (Expo Go, denied permission, missing EAS projectId, no network...).
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Manhunt Live',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    if (!projectId) {
      console.warn('[push] No EAS projectId configured; skipping push registration');
      return;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.putPushToken(token);
  } catch (err) {
    console.warn('[push] registration skipped:', err instanceof Error ? err.message : err);
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  try {
    await api.deletePushToken();
  } catch {
    /* best effort */
  }
}
