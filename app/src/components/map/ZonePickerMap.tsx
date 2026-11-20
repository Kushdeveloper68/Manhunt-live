import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import { zoneBounds, LatLng, NoGoZone } from '@manhunt/shared';
import { MAP_COLORS } from './mapConfig';
import { getMapLibre } from './maplibre';
import { useMapStyle } from './useMapStyle';
import { MapFallback } from './MapFallback';
import { MapErrorBoundary } from './MapErrorBoundary';
import { zoneFill, zoneLine, polygonsOf, lineThrough } from './geojson';

interface Props {
  center: LatLng;
  radius: number;
  /** Tap on the map while NOT drawing: move the zone centre here. */
  onCenterChange: (c: LatLng) => void;
  noGoZones: NoGoZone[];
  /** null = not drawing. Otherwise the vertices placed so far for a new no-go zone. */
  drawingPoints: LatLng[] | null;
  /** Tap on the map while drawing: add a vertex. */
  onAddPoint: (p: LatLng) => void;
}

/** The host's zone editor on a real map: tap to place the zone, tap points to outline no-go areas. */
function ZonePickerMapInner({ center, radius, onCenterChange, noGoZones, drawingPoints, onAddPoint }: Props) {
  const cameraRef = useRef<CameraRef>(null);
  const mapStyle = useMapStyle();

  // Keep the whole zone in view whenever it moves or resizes
  useEffect(() => {
    const [w, s, e, n] = zoneBounds({ center, radius });
    const t = setTimeout(() => cameraRef.current?.fitBounds([e, n], [w, s], 40, 500), 150);
    return () => clearTimeout(t);
  }, [center.latitude, center.longitude, radius]);

  const zone = { center, radius };
  const fill = useMemo(() => zoneFill(zone), [center.latitude, center.longitude, radius]);
  const edge = useMemo(() => zoneLine(zone), [center.latitude, center.longitude, radius]);
  const noGo = useMemo(() => polygonsOf(noGoZones), [noGoZones]);
  const drawing = drawingPoints && drawingPoints.length >= 2 ? lineThrough(drawingPoints) : null;

  const ML = getMapLibre();
  if (!ML) return <MapFallback />;
  const { MapView, Camera, ShapeSource, FillLayer, LineLayer, MarkerView } = ML;

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle.style}
        onDidFinishLoadingMap={mapStyle.onLoaded}
        onDidFailLoadingMap={mapStyle.onFail}
        logoEnabled={false}
        compassEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        attributionPosition={{ bottom: 6, left: 6 }}
        onPress={(feature) => {
          const coords = (feature.geometry as { coordinates: number[] }).coordinates;
          const point = { latitude: coords[1], longitude: coords[0] };
          if (drawingPoints) onAddPoint(point);
          else onCenterChange(point);
        }}
      >
        <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: [center.longitude, center.latitude], zoomLevel: 13 }} />

        <ShapeSource id="pick-fill" shape={fill}>
          <FillLayer id="pick-fill-layer" style={{ fillColor: MAP_COLORS.zone, fillOpacity: 0.1 }} />
        </ShapeSource>
        <ShapeSource id="pick-edge" shape={edge}>
          <LineLayer id="pick-edge-line" style={{ lineColor: MAP_COLORS.zone, lineWidth: 3 }} />
        </ShapeSource>

        {noGo.features.length > 0 && (
          <ShapeSource id="pick-nogo" shape={noGo}>
            <FillLayer id="pick-nogo-fill" style={{ fillColor: MAP_COLORS.noGo, fillOpacity: 0.35 }} />
            <LineLayer id="pick-nogo-line" style={{ lineColor: MAP_COLORS.noGo, lineWidth: 2 }} />
          </ShapeSource>
        )}

        {drawing && (
          <ShapeSource id="pick-drawing" shape={drawing}>
            <LineLayer id="pick-drawing-line" style={{ lineColor: MAP_COLORS.noGo, lineWidth: 3, lineDasharray: [2, 1] }} />
          </ShapeSource>
        )}

        {drawingPoints?.map((p, i) => (
          <MarkerView key={`v-${i}`} coordinate={[p.longitude, p.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.vertex}>
              <Text style={styles.vertexText}>{i + 1}</Text>
            </View>
          </MarkerView>
        ))}

        <MarkerView coordinate={[center.longitude, center.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.origin}>
            <View style={styles.originDot} />
          </View>
        </MarkerView>
      </MapView>
    </View>
  );
}

/** The zone editor, wrapped so a map failure never takes the create-game screen down. */
export function ZonePickerMap(props: Props) {
  return (
    <MapErrorBoundary>
      <ZonePickerMapInner {...props} />
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  origin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: MAP_COLORS.zone,
    backgroundColor: 'rgba(10,10,10,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  originDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: MAP_COLORS.zone },
  vertex: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: MAP_COLORS.noGo,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vertexText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
