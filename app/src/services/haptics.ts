import { useEffect, useRef } from 'react';
import { Vibration } from 'react-native';
import { useLiveGameStore } from '../stores/liveGameStore';
import { useSettingsStore } from '../stores/settingsStore';

const EARTH_RADIUS_M = 6371000;

function metersBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Zone-edge haptics: while inside the zone and within 50 m of the boundary the phone buzzes,
 * longer and more often the closer you get. Controlled by Settings.
 */
export function useGeofenceHaptics(): void {
  const enabled = useSettingsStore((s) => s.geofenceHaptics);
  const myLocation = useLiveGameStore((s) => s.myLocation);
  const zone = useLiveGameStore((s) => s.currentZone);
  const status = useLiveGameStore((s) => s.status);
  const lastBuzz = useRef(0);

  useEffect(() => {
    if (!enabled || !myLocation || !zone || status !== 'running') return;
    const toEdge = zone.radius - metersBetween(myLocation, zone.center);
    if (toEdge <= 0 || toEdge >= 50) return; // outside is handled by the out-of-zone alert

    const closeness = 1 - toEdge / 50; // 0 (far) .. 1 (at the edge)
    const cooldown = 5000 - closeness * 3500; // 5 s down to 1.5 s
    const now = Date.now();
    if (now - lastBuzz.current < cooldown) return;
    lastBuzz.current = now;
    Vibration.vibrate(Math.round(40 + closeness * 160));
  }, [enabled, myLocation, zone, status]);
}
