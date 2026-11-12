import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { useLiveGameStore } from '../stores/liveGameStore';

export const BACKGROUND_LOCATION_TASK = 'manhunt-background-location';

/** Feeds one GPS fix into the live game (updates the map and sends it to the server). */
export function applyLocation(loc: Location.LocationObject): void {
  useLiveGameStore.getState().updateLocation(
    { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
    loc.coords.speed || 0,
    loc.coords.heading || 0,
    (loc as { mocked?: boolean }).mocked === true,
    loc.coords.accuracy ?? undefined
  );
}

/**
 * The background task. It MUST be defined at module load (global scope) so Android can run it
 * while the screen is locked; this module is imported by the root layout for that reason.
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[bg-location] task error:', error.message);
    return;
  }

  // Safety net: never keep tracking someone who is not in a match (e.g. after a crash).
  if (!useLiveGameStore.getState().gameId) {
    try {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch {
      /* already stopped */
    }
    return;
  }

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations?.length) return;
  // Several fixes can arrive in one batch; the newest is what the game needs.
  applyLocation(locations[locations.length - 1]);
});
