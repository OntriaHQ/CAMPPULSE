import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { REDEMPTION_CITY_CENTER } from '@camppulse/map-config';

// Initialize Mapbox
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  size?: number;
  data?: Record<string, unknown>;
}

export interface MapLine {
  id: string;
  coordinates: { lat: number; lng: number }[];
  color?: string;
  width?: number;
}

interface Props {
  markers?: MapMarker[];
  lines?: MapLine[];
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: MapMarker) => void;
  height?: number | string;
}

export default function CampMap({
  markers = [],
  lines = [],
  onMapClick,
  onMarkerClick,
}: Props) {
  const cameraRef = useRef<Mapbox.Camera>(null);

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Dark}
        logoEnabled={false}
        attributionEnabled={false}
        onClick={(e) => {
          if (onMapClick) {
            const [lng, lat] = e.geometry.coordinates;
            onMapClick(lat, lng);
          }
        }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [REDEMPTION_CITY_CENTER.lon, REDEMPTION_CITY_CENTER.lat],
            zoomLevel: 13,
          }}
        />

        {/* Route Lines */}
        {lines.map((line) => (
          <Mapbox.ShapeSource
            key={`source-${line.id}`}
            id={`source-${line.id}`}
            shape={{
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: line.coordinates.map((c) => [c.lng, c.lat]),
              },
            }}
          >
            <Mapbox.LineLayer
              id={`layer-${line.id}`}
              style={{
                lineColor: line.color ?? '#6366f1',
                lineWidth: line.width ?? 4,
                lineJoin: 'round',
                lineCap: 'round',
                lineOpacity: 0.8,
              }}
            />
          </Mapbox.ShapeSource>
        ))}

        {/* Markers */}
        {markers.map((mkr) => (
          <Mapbox.PointAnnotation
            key={mkr.id}
            id={mkr.id}
            coordinate={[mkr.lng, mkr.lat]}
            onSelected={() => onMarkerClick?.(mkr)}
          >
            <View
              style={[
                styles.marker,
                {
                  backgroundColor: mkr.color ?? '#6366f1',
                  width: mkr.size ?? 14,
                  height: mkr.size ?? 14,
                  borderRadius: (mkr.size ?? 14) / 2,
                  shadowColor: mkr.color ?? '#6366f1',
                },
              ]}
            />
          </Mapbox.PointAnnotation>
        ))}
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  marker: {
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
});
