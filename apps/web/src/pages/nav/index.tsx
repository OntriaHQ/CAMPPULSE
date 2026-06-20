import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import { REDEMPTION_CITY_CENTER } from '@camppulse/map-config';
import CampMap from '../../components/map/CampMap';
import type { MapMarker, MapLine } from '../../components/map/CampMap';
import { calculateRoute } from '../../services/routes';
import { decodePolyline } from '../../utils/polyline';

const DESTINATIONS: Record<string, { lat: number; lon: number; label: string }> = {
  'main-auditorium': { lat: 6.9271, lon: 3.3958, label: 'Main Auditorium' },
  'north-gate': { lat: 6.9304, lon: 3.3954, label: 'North Gate' },
  'festival-arena': { lat: 6.9284, lon: 3.3974, label: 'Festival Arena' },
  'canaan-land': { lat: 6.9234, lon: 3.3934, label: 'Canaan Land' },
  'south-camp': { lat: 6.9214, lon: 3.3924, label: 'South Camp' },
  'medical-centre': { lat: 6.9254, lon: 3.3944, label: 'Medical Centre' },
};

export default function NavPage() {
  const [searchParams] = useSearchParams();
  const [dest, setDest] = useState(searchParams.get('dest') ?? '');
  const [result, setResult] = useState<{
    distance: string;
    duration: string;
    cacheHit: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [userMarker, setUserMarker] = useState<MapMarker | null>(null);
  const [destMarker, setDestMarker] = useState<MapMarker | null>(null);
  const [routeLine, setRouteLine] = useState<MapLine | null>(null);

  const originUsed = useRef<{ lat: number; lng: number }>({
    lat: REDEMPTION_CITY_CENTER.lat,
    lng: REDEMPTION_CITY_CENTER.lon,
  });
  const didAutoNavigate = useRef(false);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          originUsed.current = { lat, lng };
          setUserMarker({
            id: 'user',
            lat,
            lng,
            color: '#3b82f6',
            label: 'Your location',
            size: 18,
          });
        },
        () => {
          setUserMarker({
            id: 'user',
            lat: REDEMPTION_CITY_CENTER.lat,
            lng: REDEMPTION_CITY_CENTER.lon,
            color: '#3b82f6',
            label: 'Default location',
            size: 18,
          });
        },
        { enableHighAccuracy: false, timeout: 5000 },
      );
    }
  }, []);

  useEffect(() => {
    if (!dest || !DESTINATIONS[dest] || didAutoNavigate.current) return;
    didAutoNavigate.current = true;
    handleNavigate();
  }, [dest]);

  const handleNavigate = useCallback(async () => {
    if (!dest || !DESTINATIONS[dest]) return;
    setLoading(true);
    setError('');
    setResult(null);
    setRouteLine(null);

    const d = DESTINATIONS[dest];
    setDestMarker({ id: 'dest', lat: d.lat, lng: d.lon, color: '#ef4444', label: d.label, size: 18 });

    try {
      const route = await calculateRoute(
        { lat: originUsed.current.lat, lon: originUsed.current.lng },
        { lat: d.lat, lon: d.lon },
        'walking',
      );

      const points = decodePolyline(route.polyline);
      if (points.length > 0) {
        setRouteLine({
          id: 'route',
          coordinates: points,
          color: '#6366f1',
          width: 6,
        });
      }

      setResult({
        distance: (route.distance_metres / 1000).toFixed(1),
        duration: Math.round(route.duration_seconds / 60).toString(),
        cacheHit: route.cache_hit,
      });
    } catch (e: any) {
      setError(e.message || 'Failed to calculate route');
    } finally {
      setLoading(false);
    }
  }, [dest]);

  const markers = [userMarker, destMarker].filter(Boolean) as MapMarker[];
  const lines = routeLine ? [routeLine] : [];

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      fontFamily: "'Poppins', sans-serif",
      background: 'var(--bg, #0a0a1a)',
      color: '#fff',
      overflow: 'hidden',
    }}>
      {/* Map area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <CampMap
          markers={markers}
          lines={lines}
          height="100vh"
        />

        {/* Top bar overlay */}
        <div style={{
          position: 'absolute', top: 16, left: 16, right: 16,
          display: 'flex', alignItems: 'center', gap: 12, zIndex: 10,
        }}>
          <div style={{
            background: 'rgba(13,13,24,0.92)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '8px 16px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            }} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>CampPulse</span>
            <span style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 4,
              background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)',
            }}>Navigator</span>
          </div>

          <a href="/nav/qr" style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
            background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.3)',
            color: '#06b6d4', textDecoration: 'none', fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}>QR Codes</a>

          <div style={{
            flex: 1, maxWidth: 400,
            display: 'flex', gap: 8,
          }}>
            <select
              value={dest}
              onChange={e => setDest(e.target.value)}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 13,
                background: 'rgba(13,13,24,0.92)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff', fontFamily: 'inherit',
              }}
            >
              <option value="">Select destination</option>
              {Object.entries(DESTINATIONS).map(([key, v]) => (
                <option key={key} value={key} style={{ background: '#1a1a3e' }}>{v.label}</option>
              ))}
            </select>

            <button
              onClick={handleNavigate}
              disabled={!dest || loading}
              style={{
                padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #06b6d4)',
                border: 'none', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Routing…' : 'Go'}
            </button>
          </div>
        </div>

        {/* Error overlay */}
        {error && (
          <div style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            padding: '10px 20px', borderRadius: 10,
            background: 'rgba(239,68,68,0.9)', color: '#fff',
            fontSize: 13, zIndex: 10,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Info sidebar */}
      <div style={{
        width: 280, padding: 20,
        display: 'flex', flexDirection: 'column', gap: 16,
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(13,13,24,0.5)',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Route Info</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            Walking directions · Redemption City
          </p>
        </div>

        {!result && !loading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
            Select a destination and tap Go to calculate your route.
          </div>
        )}

        {loading && (
          <div style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            Calculating route…
          </div>
        )}

        {result && (
          <>
            <div style={{
              padding: 16, borderRadius: 12,
              background: 'rgba(99,102,241,0.1)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Route summary</div>
              <div style={{ display: 'flex', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{result.distance}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>km</div>
                </div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{result.duration}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>min</div>
                </div>
              </div>
              {result.cacheHit && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#22c55e' }}>Cached route</div>
              )}
            </div>

            <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,0.03)', fontSize: 13 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>From</div>
              <div style={{ fontWeight: 500 }}>
                {userMarker ? `${userMarker.lat.toFixed(4)}, ${userMarker.lng.toFixed(4)}` : 'Current location'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '8 0' }}>To</div>
              <div style={{ fontWeight: 500 }}>{dest ? DESTINATIONS[dest]?.label : '—'}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
