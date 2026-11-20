import { useCallback, useEffect, useRef, useState } from 'react';
import { MAP_STYLE_URL } from './mapConfig';

/** A style with only a dark background: zone, pins and pings still work when no tiles can load. */
export const BLANK_STYLE = JSON.stringify({
  version: 8,
  name: 'manhunt-blank',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0E0E0E' } }],
});

const FALLBACK_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
/** How long to wait for a style before trying the next one. */
const STYLE_TIMEOUT_MS = 12_000;

const CHAIN = Array.from(new Set([MAP_STYLE_URL, FALLBACK_STYLE_URL, BLANK_STYLE]));

/**
 * Picks the map style and falls back automatically:
 *   your style -> OpenFreeMap positron -> plain dark background.
 * The game stays playable even if the tile server is down or the phone is offline.
 */
export function useMapStyle() {
  const [index, setIndex] = useState(0);
  const loaded = useRef(false);
  const last = CHAIN.length - 1;

  useEffect(() => {
    loaded.current = false;
    if (index >= last) return;
    const t = setTimeout(() => {
      if (!loaded.current) setIndex((i) => Math.min(i + 1, last));
    }, STYLE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [index, last]);

  const onLoaded = useCallback(() => {
    loaded.current = true;
  }, []);
  const onFail = useCallback(() => setIndex((i) => Math.min(i + 1, last)), [last]);

  return {
    style: CHAIN[index],
    /** true once we gave up on real map tiles */
    offline: index === last,
    onLoaded,
    onFail,
  };
}
