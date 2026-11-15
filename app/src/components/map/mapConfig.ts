/**
 * Map style. OpenFreeMap's dark style needs no API key. It is a free community service
 * (no uptime guarantee), so the URL can be swapped without a rebuild:
 *   EXPO_PUBLIC_MAP_STYLE_URL=https://api.maptiler.com/maps/dataviz-dark/style.json?key=YOUR_KEY
 */
export const MAP_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/dark';

export const MAP_COLORS = {
  zone: '#C6FF00',
  nextZone: '#FFB020',
  noGo: '#FF3B30',
  chaser: '#FF3B5C',
  runner: '#22D3EE',
  dim: '#000000',
  canvas: '#0E0E0E',
} as const;

export const roleColor = (role?: string) => (role === 'CHASER' ? MAP_COLORS.chaser : MAP_COLORS.runner);
