import * as Location from 'expo-location';
import { useLiveGameStore } from '../stores/liveGameStore';

let locationSubscription: Location.LocationSubscription | null = null;
let currentTrackingInterval = 5000;

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
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 3,
      },
      (loc) => {
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        const speed = loc.coords.speed || 0;
        const heading = loc.coords.heading || 0;
        const isMock = (loc as any).mocked === true;

        useLiveGameStore.getState().updateLocation(coords, speed, heading, isMock);

        // Adaptive interval adjustment
        if (speed > 3.5 && currentTrackingInterval !== 2000) {
          currentTrackingInterval = 2000;
        } else if (speed < 0.8 && currentTrackingInterval !== 10000) {
          currentTrackingInterval = 10000;
        } else if (currentTrackingInterval !== 5000) {
          currentTrackingInterval = 5000;
        }
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
