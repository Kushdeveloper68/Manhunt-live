import type { Feature, FeatureCollection, Polygon, LineString } from 'geojson';
import { circleRing, worldWithHole, zonePolygon, LatLng } from '@manhunt/shared';

type Zone = { center: LatLng; radius: number };

export const ringOf = (zone: Zone, steps = 96) => circleRing(zone.center, zone.radius, steps);

/** Everything OUTSIDE the zone (a world polygon with the zone cut out), used to dim the outside. */
export const dimOutside = (zone: Zone): Feature<Polygon> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: worldWithHole(ringOf(zone)) },
});

export const zoneFill = (zone: Zone): Feature<Polygon> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: zonePolygon(ringOf(zone)) },
});

export const zoneLine = (zone: Zone): Feature<LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: ringOf(zone) },
});

const closed = (pts: LatLng[]): number[][] => {
  const ring = pts.map((p) => [p.longitude, p.latitude]);
  return [...ring, ring[0]];
};

export const polygonsOf = (zones: { polygon: LatLng[] }[]): FeatureCollection<Polygon> => ({
  type: 'FeatureCollection',
  features: zones
    .filter((z) => z.polygon.length >= 3)
    .map((z) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [closed(z.polygon)] },
    })),
});

/** An open line through points (used while drawing a no-go zone). */
export const lineThrough = (pts: LatLng[]): Feature<LineString> => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'LineString', coordinates: pts.map((p) => [p.longitude, p.latitude]) },
});
