import { NativeModules } from 'react-native';

type MapLibreModule = typeof import('@maplibre/maplibre-react-native');

let cached: MapLibreModule | null | undefined;
let loadError: string | null = null;

/**
 * Loads MapLibre on demand. If this APK was built before MapLibre was added (or the native part
 * is missing), the app shows a clear "install the new build" message instead of a red crash screen.
 */
export function getMapLibre(): MapLibreModule | null {
  if (cached !== undefined) return cached;
  // The native half of MapLibre lives in the APK. An APK built before it was added (or with the
  // wrong architecture) has no such module: say so plainly instead of crashing inside the library.
  if (!NativeModules.MLRNModule) {
    cached = null;
    loadError = 'Native module MLRNModule is missing from this build (the APK was built before the map was added).';
    console.warn('[map]', loadError);
    return cached;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@maplibre/maplibre-react-native') as MapLibreModule;
  } catch (err) {
    cached = null;
    loadError = err instanceof Error ? err.message : String(err);
    console.warn('[map] MapLibre could not be loaded:', loadError);
  }
  return cached;
}

export const mapLibreLoadError = (): string | null => loadError;
