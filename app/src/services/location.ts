import * as Location from 'expo-location';
import { useSettingsStore } from '../stores/settingsStore';
import { useTrackingStore } from '../stores/trackingStore';
import { BACKGROUND_LOCATION_TASK, applyLocation } from './backgroundLocation';

let foregroundSubscription: Location.LocationSubscription | null = null;

/** GPS precision/battery trade-off comes from the user's settings. */
function trackingOptions(): Location.LocationOptions {
  const s = useSettingsStore.getState();
  if (s.lowBatteryMode) return { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 10 };
  if (s.highPrecisionGps) return { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 3 };
  return { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 5 };
}

export function isTrackingLocation(): boolean {
  return useTrackingStore.getState().mode !== 'off';
}

/** Re-apply settings (e.g. low-battery mode toggled) to a running tracker. */
export async function restartLocationTracking(): Promise<void> {
  if (isTrackingLocation()) await startLocationTracking();
}

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== 'granted') return false;

  const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
  return bgStatus === 'granted';
}

/**
 * Starts GPS tracking for a match.
 * - With "Allow all the time": a foreground service keeps tracking while the screen is locked.
 * - Without it: falls back to tracking only while the app is open, and the UI warns about it.
 */
export async function startLocationTracking(): Promise<boolean> {
  try {
    let fg = (await Location.getForegroundPermissionsAsync()).status;
    if (fg !== 'granted') fg = (await Location.requestForegroundPermissionsAsync()).status;
    if (fg !== 'granted') {
      useTrackingStore.getState().setMode('off');
      return false;
    }

    let bg = (await Location.getBackgroundPermissionsAsync()).status;
    if (bg !== 'granted') bg = (await Location.requestBackgroundPermissionsAsync()).status;

    await stopLocationTracking(); // clean restart (also when settings change)

    if (bg === 'granted') {
      try {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          ...trackingOptions(),
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
          activityType: Location.ActivityType.Fitness,
          foregroundService: {
            notificationTitle: 'MANHUNT LIVE: match active',
            notificationBody: 'Sharing your location with your game. Open the app to leave.',
            notificationColor: '#C6FF00',
            killServiceOnDestroy: true, // swiping the app away stops tracking
          },
        });
        useTrackingStore.getState().setMode('background');
        return true;
      } catch (err) {
        console.warn('[location] background tracking unavailable, using foreground only:', err);
      }
    }

    foregroundSubscription = await Location.watchPositionAsync(trackingOptions(), applyLocation);
    useTrackingStore.getState().setMode('foreground');
    return true;
  } catch (err) {
    console.warn('Error initiating location tracking:', err);
    useTrackingStore.getState().setMode('off');
    return false;
  }
}

export async function stopLocationTracking(): Promise<void> {
  if (foregroundSubscription) {
    foregroundSubscription.remove();
    foregroundSubscription = null;
  }
  try {
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    /* task not registered */
  }
  useTrackingStore.getState().setMode('off');
}
