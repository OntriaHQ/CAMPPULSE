import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import CampMap from '../../components/map/CampMap';
import type { MapMarker } from '../../components/map/CampMap';
import { fetchLiveMapData } from '../../services/drivers';
import type { LiveMapData } from '../../services/drivers';
import boundaryData from '@camppulse/map-config/src/boundary.json';
import { useGuestWebSocket } from '../../hooks/useWebSocket';

const SEV_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
};

const ZONE_COLORS: Record<string, string> = {
  'Zone A': '#8B5CF6',
  'Zone B': '#EC4899',
};

export default function AdminMapPage() {
  const [data, setData] = useState<LiveMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<MapMarker | null>(null);
  const [alert, setAlert] = useState<{ zone: string; severity: string } | null>(null);

  const { subscribe } = useGuestWebSocket();

  const loadData = useCallback(async () => {
    try {
      const d = await fetchLiveMapData();
      setData(d);
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const unsubAlert = subscribe('zone_alert', (msg: any) => {
      setAlert({ zone: msg.payload?.zone, severity: msg.payload?.severity });
      loadData();
    });
    const unsubClearing = subscribe('zone_clearing', () => {
      loadData();
    });
    return () => {
      unsubAlert?.();
      unsubClearing?.();
    };
  }, [subscribe]);

  const incidentMarkers: MapMarker[] = (data?.incidents ?? []).map((inc) => ({
    id: inc.id,
    lat: inc.lat,
    lng: inc.lon,
    color: SEV_COLOR[inc.severity] ?? '#888',
    label: `${inc.type} — ${inc.severity} [${inc.zone}]`,
    size: 14,
    data: inc as unknown as Record<string, unknown>,
  }));

  const userMarkers: MapMarker[] = (data?.users ?? []).map((u) => ({
    id: `user-${u.user_id}`,
    lat: u.lat,
    lng: u.lon,
    color: '#60a5fa',
    label: `User in ${u.zone}`,
    size: 8,
  }));

  const allMarkers = [...incidentMarkers, ...userMarkers];

  const areaCounts: Record<string, number> = {};
  (data?.incidents ?? []).forEach((inc) => {
    const z = inc.zone ?? 'Unknown';
    areaCounts[z] = (areaCounts[z] || 0) + 1;
  });

  const AREA_SUMMARY = Object.entries(areaCounts).map(([name, count]) => ({
    name,
    count,
    color: count > 5 ? '#EF4444' : count > 2 ? '#F97316' : '#EAB308',
  }));
  const maxAreaCount = Math.max(...AREA_SUMMARY.map((a) => a.count), 1);

  function handleMarkerClick(marker: MapMarker) {
    setSelectedIncident(marker);
  }

  return (
    <AdminLayout title="Camp Map" subtitle="Redemption City · live Mapbox overlay">
      <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 156px)' }}>
        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <CampMap
            markers={allMarkers}
            lines={[]}
            onMarkerClick={handleMarkerClick}
            height="100%"
            boundary={boundaryData as any}
          />

          {error && (
            <div style={{
              position: 'absolute', top: 12, left: 12, right: 12,
              padding: '8px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.9)', color: '#fff',
              fontSize: 12, zIndex: 10,
            }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--textMuted)', fontSize: 13, zIndex: 10,
            }}>
              Loading live data…
            </div>
          )}

          {/* Congestion alert banner */}
          {alert && (
            <div style={{
              position: 'absolute', top: 12, left: 12, right: 12, zIndex: 20,
              padding: '10px 16px', borderRadius: 8,
              background: alert.severity === 'critical' ? 'rgba(239,68,68,0.9)' : 'rgba(249,115,22,0.9)',
              color: '#fff', fontSize: 13,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Congestion in {alert.zone} ({alert.severity})</span>
              <button onClick={() => setAlert(null)} style={{
                background: 'none', border: 'none', color: '#fff',
                cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1,
              }}>&times;</button>
            </div>
          )}

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16, zIndex: 10,
            background: 'rgba(13,13,24,0.90)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '10px 14px',
            display: 'flex', gap: 14, alignItems: 'center',
          }}>
            {[
              ['Critical', '#EF4444'],
              ['High', '#F97316'],
              ['Medium', '#EAB308'],
              ['Low', '#22C55E'],
              ['User', '#60a5fa'],
            ].map(([label, color]) => (
              <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: color as string,
                }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                  {label as string}
                </span>
              </div>
            ))}
          </div>

          {/* Selected incident popup */}
          {selectedIncident && (
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 10,
              background: 'rgba(13,13,24,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 14, maxWidth: 240,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {String(selectedIncident.data?.type ?? 'Incident')}
                </span>
                <button
                  onClick={() => setSelectedIncident(null)}
                  style={{
                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1,
                  }}
                >
                  &times;
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                <div>Severity: {String(selectedIncident.data?.severity ?? '—')}</div>
                <div>Status: {String(selectedIncident.data?.status ?? '—')}</div>
                <div>Zone: {String(selectedIncident.data?.zone ?? '—')}</div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            className="card"
            style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div className="card-title">
              Open Reports ({incidentMarkers.length})
            </div>
            <div
              style={{
                flex: 1, overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}
            >
              {incidentMarkers.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--textMuted)', fontSize: 12 }}>
                  No open incidents
                </div>
              ) : (
                incidentMarkers.slice(0, 15).map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleMarkerClick(m)}
                    style={{
                      padding: '12px 14px', borderRadius: 10,
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: m.color, flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {m.label?.split(' —')[0] ?? 'Incident'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--textMuted)', marginTop: 2 }}>
                        {String(m.data?.zone ?? 'Unknown')}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 10, color: m.color,
                      fontWeight: 600, textTransform: 'uppercase',
                    }}>
                      {String(m.data?.severity ?? '')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Reports by Area</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {AREA_SUMMARY.length === 0 ? (
                <div style={{ padding: 10, textAlign: 'center', color: 'var(--textMuted)', fontSize: 12 }}>
                  No area data
                </div>
              ) : (
                AREA_SUMMARY.map((a) => (
                  <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, width: 96,
                      color: 'var(--textSub)', flexShrink: 0,
                    }}>
                      {a.name}
                    </span>
                    <div style={{
                      flex: 1, height: 4, borderRadius: 2,
                      background: 'var(--surface2)', overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', background: a.color,
                        width: `${(a.count / maxAreaCount) * 100}%`,
                        borderRadius: 2,
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: a.color, width: 20 }}>
                      {a.count}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--textMuted)' }}>
              {data?.users.length ?? 0} active users on map
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
