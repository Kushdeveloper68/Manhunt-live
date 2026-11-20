type MapLibreModule = typeof import('@maplibre/maplibre-react-native');

let cached: MapLibreModule | null | undefined;
let loadError: string | null = null;

/**
 * Loads MapLibre on demand. If this APK was built before MapLibre was added (or the native part
 * is missing), the app shows a clear "install the new build" message instead of a red crash screen.
 */
export function getMapLibre(): MapLibreModule | null {
  if (cached !== undefined) return cached;
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
