import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { zoneBounds } from '@manhunt/shared';
import { useAuthStore } from '../../stores/authStore';
import { useLiveGameStore, serverNow } from '../../stores/liveGameStore';
import { formatAge } from '@manhunt/shared';
import { MAP_COLORS, roleColor } from './mapConfig';
import { getMapLibre } from './maplibre';
import { useMapStyle } from './useMapStyle';
import { MapFallback } from './MapFallback';
import { MapErrorBoundary } from './MapErrorBoundary';
import { Text } from 'react-native';
import { dimOutside, zoneLine, polygonsOf } from './geojson';
import { SelfPin, PlayerPin, PingPin, SosPin, FellPin } from './Pins';

export interface GameMapHandle {
  /** Jump to my position and follow it again. */
  recenter: () => void;
  /** Zoom out so the whole play zone is visible. */
  fitZone: () => void;
}

interface Props {
  /** Spectators see everyone and don't follow their own position. */
  spectator?: boolean;
  /** Keeps the attribution text clear of the bottom controls. */
  bottomInset?: number;
  /** Spectators: centre the camera on this position (a selected player). */
  focus?: { latitude: number; longitude: number } | null;
}

/**
 * The live game map: real streets, the zone (and a preview of the next one), no-go zones,
 * you, your teammates, and revealed pings that fade as they get old.
 */
const GameMapInner = forwardRef<GameMapHandle, Props>(function GameMapInner({ spectator = false, bottomInset = 150, focus = null }, ref) {
  const cameraRef = useRef<CameraRef>(null);
  const myId = useAuthStore((s) => s.user?.id);

  const myLocation = useLiveGameStore((s) => s.myLocation);
  const myHeading = useLiveGameStore((s) => s.myHeading);
  const myRole = useLiveGameStore((s) => s.myRole);
  const zone = useLiveGameStore((s) => s.currentZone);
  const noGoZones = useLiveGameStore((s) => s.noGoZones);
  const teammates = useLiveGameStore((s) => s.teammateLocations);
  const runnerSnapshots = useLiveGameStore((s) => s.runnerSnapshots);
  const chaserSnapshots = useLiveGameStore((s) => s.chaserSnapshots);
  const shrinkWarning = useLiveGameStore((s) => s.shrinkWarning);
  const revealIntervalMin = useLiveGameStore((s) => s.revealIntervalMin);
  const incomingSos = useLiveGameStore((s) => s.incomingSos);

  const mapStyle = useMapStyle();
  const [following, setFollowing] = useState(!spectator);
  const [, setTick] = useState(0);

  const hasPings = runnerSnapshots.length > 0 || chaserSnapshots.length > 0;
  // Re-render every second so "42s ago" labels and fading stay current
  useEffect(() => {
    if (!hasPings) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [hasPings]);

  const fitZone = useCallback(() => {
    if (!zone) return;
    const [w, s, e, n] = zoneBounds(zone);
    setFollowing(false);
    cameraRef.current?.fitBounds([e, n], [w, s], 48, 700);
  }, [zone]);

  const recenter = useCallback(() => {
    setFollowing(true);
    if (myLocation) {
      cameraRef.current?.setCamera({
        centerCoordinate: [myLocation.longitude, myLocation.latitude],
        zoomLevel: 16,
        animationDuration: 600,
        animationMode: 'easeTo',
      });
    } else {
      fitZone();
    }
  }, [myLocation, fitZone]);

  useImperativeHandle(ref, () => ({ recenter, fitZone }), [recenter, fitZone]);

  // Follow my position while "following" is on
  useEffect(() => {
    if (!following || !myLocation) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [myLocation.longitude, myLocation.latitude],
      animationDuration: 500,
      animationMode: 'easeTo',
    });
  }, [myLocation, following]);

  // Spectator camera lock on a chosen player
  useEffect(() => {
    if (!focus) return;
    setFollowing(false);
    cameraRef.current?.setCamera({
      centerCoordinate: [focus.longitude, focus.latitude],
      zoomLevel: 17,
      animationDuration: 700,
      animationMode: 'easeTo',
    });
  }, [focus?.latitude, focus?.longitude]);

  // Spectators start zoomed out on the whole zone
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (spectator && zone && !fittedOnce.current) {
      fittedOnce.current = true;
      setTimeout(fitZone, 400);
    }
  }, [spectator, zone, fitZone]);

  const dim = useMemo(() => (zone ? dimOutside(zone) : null), [zone]);
  const edge = useMemo(() => (zone ? zoneLine(zone) : null), [zone]);
  const nextEdge = useMemo(() => (shrinkWarning ? zoneLine(shrinkWarning.nextZone) : null), [shrinkWarning]);
  const noGo = useMemo(() => polygonsOf(noGoZones), [noGoZones]);

  const initialCenter = myLocation
    ? [myLocation.longitude, myLocation.latitude]
    : zone
      ? [zone.center.longitude, zone.center.latitude]
      : [0, 0];

  const now = serverNow();
  const revealMs = Math.max(1, revealIntervalMin) * 60_000;
  const fade = (ts: number) => Math.max(0.35, 1 - (now - ts) / (revealMs * 2));
  const isRunner = myRole === 'RUNNER';
  const others = teammates.filter((l) => l.userId !== myId);

  const ML = getMapLibre();
  if (!ML) return <MapFallback />;
  const { MapView, Camera, ShapeSource, FillLayer, LineLayer, MarkerView } = ML;

  return (
    <View style={styles.fill}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle.style}
        onDidFinishLoadingMap={mapStyle.onLoaded}
        onDidFailLoadingMap={mapStyle.onFail}
        logoEnabled={false}
        compassEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        attributionPosition={{ bottom: bottomInset, left: 8 }}
        onRegionWillChange={(f) => {
          if (f?.properties?.isUserInteraction) setFollowing(false);
        }}
      >
        <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: initialCenter, zoomLevel: spectator ? 14 : 16 }} />

        {dim && (
          <ShapeSource id="zone-dim" shape={dim}>
            <FillLayer id="zone-dim-fill" style={{ fillColor: MAP_COLORS.dim, fillOpacity: 0.55 }} />
          </ShapeSource>
        )}
        {noGo.features.length > 0 && (
          <ShapeSource id="no-go" shape={noGo}>
            <FillLayer id="no-go-fill" style={{ fillColor: MAP_COLORS.noGo, fillOpacity: 0.3 }} />
            <LineLayer id="no-go-line" style={{ lineColor: MAP_COLORS.noGo, lineWidth: 2 }} />
          </ShapeSource>
        )}
        {edge && (
          <ShapeSource id="zone-edge" shape={edge}>
            <LineLayer id="zone-edge-line" style={{ lineColor: MAP_COLORS.zone, lineWidth: 3 }} />
          </ShapeSource>
        )}
        {nextEdge && (
          <ShapeSource id="zone-next" shape={nextEdge}>
            <LineLayer
              id="zone-next-line"
              style={{ lineColor: MAP_COLORS.nextZone, lineWidth: 3, lineDasharray: [2, 2] }}
            />
          </ShapeSource>
        )}

        {/* Revealed runner positions (chasers + spectators) */}
        {!isRunner &&
          runnerSnapshots.map((p) => (
            <MarkerView key={`ping-${p.userId}`} coordinate={[p.coordinates.longitude, p.coordinates.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
              <PingPin color={MAP_COLORS.runner} label={`@${p.username} · ${formatAge(now - p.timestamp)}`} opacity={fade(p.timestamp)} />
            </MarkerView>
          ))}

        {/* BOTH_WAYS: revealed chaser positions (runners + spectators) */}
        {(isRunner || spectator) &&
          chaserSnapshots.map((p) => (
            <MarkerView key={`cping-${p.userId}`} coordinate={[p.coordinates.longitude, p.coordinates.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
              <PingPin color={MAP_COLORS.chaser} label={`@${p.username} · ${formatAge(now - p.timestamp)}`} opacity={fade(p.timestamp)} />
            </MarkerView>
          ))}

        {/* Live players: teammates (or everyone for spectators / exposed runners) */}
        {others.map((l) => (
          <MarkerView key={`live-${l.userId}`} coordinate={[l.coordinates.longitude, l.coordinates.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
            <PlayerPin color={roleColor(l.role)} label={`@${l.username}`} />
          </MarkerView>
        ))}

        {/* Host: players who pressed SOS */}
        {Object.values(incomingSos)
          .filter((s) => s.coordinates)
          .map((s) => (
            <MarkerView key={`sos-${s.userId}`} coordinate={[s.coordinates!.longitude, s.coordinates!.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
              <SosPin label={`@${s.username}`} />
            </MarkerView>
          ))}

        {/* Spectator: where I was eliminated */}
        {myLocation && spectator && (
          <MarkerView coordinate={[myLocation.longitude, myLocation.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
            <FellPin />
          </MarkerView>
        )}

        {/* Me */}
        {myLocation && !spectator && (
          <MarkerView coordinate={[myLocation.longitude, myLocation.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
            <SelfPin color={isRunner ? MAP_COLORS.runner : MAP_COLORS.chaser} heading={myHeading} />
          </MarkerView>
        )}
      </MapView>
      {mapStyle.offline && (
        <View pointerEvents="none" style={[styles.offlineChip, { bottom: bottomInset + 44 }]}>
          <Text style={styles.offlineText}>MAP TILES OFFLINE · zone and players are still live</Text>
        </View>
      )}
    </View>
  );
});

/** The live game map, wrapped so a map failure never takes the whole screen down. */
export const GameMap = forwardRef<GameMapHandle, Props>(function GameMap(props, ref) {
  return (
    <MapErrorBoundary>
      <GameMapInner ref={ref} {...props} />
    </MapErrorBoundary>
  );
});

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: MAP_COLORS.canvas },
  offlineChip: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(10,10,10,0.85)',
    borderColor: '#FFB020',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  offlineText: { color: '#FFB020', fontSize: 10, fontWeight: '700' },
});
