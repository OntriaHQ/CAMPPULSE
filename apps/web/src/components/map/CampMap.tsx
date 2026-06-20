import { useEffect, useRef, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { REDEMPTION_CITY_CENTER } from '@camppulse/map-config';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

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
  dash?: number[];
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  weight?: number; // 0.0 – 1.0
}

interface Props {
  markers?: MapMarker[];
  lines?: MapLine[];
  heatmapPoints?: HeatmapPoint[];
  boundary?: { coordinates: [number, number][][] } | null;
  zones?: Array<{
    id: string;
    name: string;
    coordinates: [number, number][][];
    color?: string;
  }>;
  onMapClick?: (lat: number, lng: number) => void;
  onMarkerClick?: (marker: MapMarker) => void;
  interactive?: boolean;
  height?: string;
}

const DEFAULT_STYLE = 'mapbox://styles/mapbox/dark-v11';

export default function CampMap({
  markers = [],
  lines = [],
  heatmapPoints = [],
  boundary,
  zones,
  onMapClick,
  onMarkerClick,
  interactive = true,
  height = '100%',
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const initMap = useCallback(() => {
    if (!container.current || mapRef.current) return;

    if (!TOKEN) {
      setError('Mapbox token not configured. Set VITE_MAPBOX_TOKEN.');
      return;
    }

    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: container.current,
      style: DEFAULT_STYLE,
      center: [REDEMPTION_CITY_CENTER.lon, REDEMPTION_CITY_CENTER.lat],
      zoom: 13,
      attributionControl: false,
      interactive,
    });

    map.on('load', () => {
      setLoaded(true);
    });

    map.on('error', (e) => {
      console.error('Mapbox error:', e);
    });

    if (onMapClick) {
      map.on('click', (e) => {
        onMapClick(e.lngLat.lat, e.lngLat.lng);
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, [interactive, onMapClick]);

  useEffect(() => {
    const cleanup = initMap();
    return () => cleanup?.();
  }, [initMap]);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    markers.forEach((mkr) => {
      const el = document.createElement('div');
      el.style.width = `${mkr.size ?? 14}px`;
      el.style.height = `${mkr.size ?? 14}px`;
      el.style.borderRadius = '50%';
      el.style.background = mkr.color ?? '#6366f1';
      el.style.cursor = 'pointer';
      el.style.boxShadow = `0 0 6px ${mkr.color ?? '#6366f1'}80`;
      el.title = mkr.label ?? '';

      if (onMarkerClick && mkr.data) {
        el.addEventListener('click', () => onMarkerClick(mkr));
      }

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([mkr.lng, mkr.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [markers, loaded, onMarkerClick]);

  // Update route lines
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const sourceIds = map.getStyle()?.sources
      ? Object.keys(map.getStyle().sources!).filter((k) => k.startsWith('route-'))
      : [];

    sourceIds.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    lines.forEach((line) => {
      const srcId = `route-${line.id}`;
      const coords = line.coordinates.map((c) => [c.lng, c.lat]);

      map.addSource(srcId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        },
      });

      map.addLayer({
        id: srcId,
        type: 'line',
        source: srcId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': line.color ?? '#6366f1',
          'line-width': line.width ?? 5,
          'line-opacity': 0.85,
          ...(line.dash ? { 'line-dasharray': line.dash } : {}),
        },
      });
    });
  }, [lines, loaded]);

  // Heatmap layer for congestion / incident density
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const SRC = 'incidents-heat-src';
    const LAYER = 'incidents-heat';

    if (map.getLayer(LAYER)) map.removeLayer(LAYER);
    if (map.getSource(SRC)) map.removeSource(SRC);

    if (!heatmapPoints.length) return;

    map.addSource(SRC, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: heatmapPoints.map(p => ({
          type: 'Feature' as const,
          properties: { weight: p.weight ?? 0.5 },
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        })),
      },
    });

    const firstSymbol = map.getStyle().layers?.find(l => l.type === 'symbol')?.id;

    map.addLayer({
      id: LAYER,
      type: 'heatmap',
      source: SRC,
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 16, 2.0],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0,   'rgba(0,0,0,0)',
          0.15, 'rgba(234,179,8,0.4)',
          0.4,  'rgba(249,115,22,0.6)',
          0.7,  'rgba(239,68,68,0.78)',
          1,    'rgba(239,68,68,0.92)',
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 45, 14, 70, 17, 100],
        'heatmap-opacity': 0.78,
      },
    }, firstSymbol);
  }, [heatmapPoints, loaded]);

  // Render camp boundary
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !boundary) return;

    const srcId = 'camp-boundary';
    const layerId = 'camp-boundary-fill';
    const outlineId = 'camp-boundary-outline';

    if (map.getLayer(outlineId)) map.removeLayer(outlineId);
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(srcId)) map.removeSource(srcId);

    map.addSource(srcId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: boundary.coordinates,
        },
      },
    });

    map.addLayer({
      id: layerId,
      type: 'fill',
      source: srcId,
      paint: {
        'fill-color': '#6366f1',
        'fill-opacity': 0.06,
      },
    });

    map.addLayer({
      id: outlineId,
      type: 'line',
      source: srcId,
      paint: {
        'line-color': '#6366f1',
        'line-width': 2,
        'line-dasharray': [4, 4],
        'line-opacity': 0.5,
      },
    });
  }, [boundary, loaded]);

  // Render zone polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !zones?.length) return;

    ['zone-fill', 'zone-outline'].forEach(lid => {
      if (map.getLayer(lid)) map.removeLayer(lid);
    });
    ['zone-source'].forEach(sid => {
      if (map.getSource(sid)) map.removeSource(sid);
    });

    const features = zones.map(z => ({
      type: 'Feature' as const,
      properties: { name: z.name, color: z.color ?? '#6366f1' },
      geometry: {
        type: 'Polygon' as const,
        coordinates: z.coordinates,
      },
    }));

    map.addSource('zone-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });

    map.addLayer({
      id: 'zone-fill',
      type: 'fill',
      source: 'zone-source',
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': 0.04,
      },
    });

    map.addLayer({
      id: 'zone-outline',
      type: 'line',
      source: 'zone-source',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1,
        'line-dasharray': [2, 3],
        'line-opacity': 0.35,
      },
    });
  }, [zones, loaded]);

  if (error) {
    return (
      <div style={{
        height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--surface1)', color: 'var(--textMuted)', fontSize: 13,
        borderRadius: 12,
      }}>
        {error}
      </div>
    );
  }

  return (
    <div
      ref={container}
      style={{ width: '100%', height, borderRadius: 12, overflow: 'hidden' }}
    />
  );
}
