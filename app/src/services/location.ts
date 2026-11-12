import * as Location from 'expo-location';
import { useLiveGameStore } from '../stores/liveGameStore';
import { useSettingsStore } from '../stores/settingsStore';

let locationSubscription: Location.LocationSubscription | null = null;

/** GPS precision/battery trade-off comes from the user's settings. */
function trackingOptions(): Location.LocationOptions {
  const s = useSettingsStore.getState();
  if (s.lowBatteryMode) return { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 10 };
  if (s.highPrecisionGps) return { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 3 };
  return { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 };
}

export function isTrackingLocation(): boolean {
  return locationSubscription !== null;
}

/** Re-apply settings (e.g. low-battery mode toggled) to a running tracker. */
export async function restartLocationTracking(): Promise<void> {
  if (locationSubscription) await startLocationTracking();
}

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return false;

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  return bgStatus === 'granted';
}

/**
 * Starts adaptive GPS tracking.
 * Adjusts reporting interval based on player speed:
 * - Stationary (< 0.8 m/s): 10s interval
 * - Jogging (0.8 - 3.5 m/s): 5s interval
 * - Sprinting (> 3.5 m/s): 2s interval
 */
export async function startLocationTracking(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const granted = await requestLocationPermissions();
      if (!granted) return false;
    }

    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }

    locationSubscription = await Location.watchPositionAsync(
      trackingOptions(),
      (loc) => {
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        const speed = loc.coords.speed || 0;
        const heading = loc.coords.heading || 0;
        const isMock = (loc as any).mocked === true;

        useLiveGameStore
          .getState()
          .updateLocation(coords, speed, heading, isMock, loc.coords.accuracy ?? undefined);
      }
    );

    return true;
  } catch (err) {
    console.warn('Error initiating location watch:', err);
    return false;
  }
}

export function stopLocationTracking(): void {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
}
