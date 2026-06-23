import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import CampMap from '../../components/map/CampMap';
import type { MapMarker, HeatmapPoint } from '../../components/map/CampMap';
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

const SEV_WEIGHT: Record<string, number> = {
  critical: 1.0,
  high: 0.7,
  medium: 0.35,
  low: 0.15,
};

function congestionLabel(score: number): { label: string; color: string } {
  if (score >= 2.5) return { label: 'Critical', color: '#EF4444' };
  if (score >= 1.5) return { label: 'High',     color: '#F97316' };
  if (score >= 0.7) return { label: 'Moderate', color: '#EAB308' };
  return                    { label: 'Clear',   color: '#22C55E' };
}

export default function AdminMapPage() {
  const [data,            setData]            = useState<LiveMapData | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [selectedIncident,setSelectedIncident]= useState<MapMarker | null>(null);
  const [alert,           setAlert]           = useState<{ zone: string; severity: string } | null>(null);
  const [showHeatmap,     setShowHeatmap]     = useState(true);
  const [showUsers,       setShowUsers]       = useState(false);

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
    const interval = setInterval(loadData, 20_000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const unsubAlert = subscribe('zone_alert', (msg: any) => {
      setAlert({ zone: msg.payload?.zone, severity: msg.payload?.severity });
      loadData();
    });
    const unsubClearing = subscribe('zone_clearing', () => loadData());
    return () => { unsubAlert?.(); unsubClearing?.(); };
  }, [subscribe, loadData]);

  // --- derived data ---

  const incidentMarkers: MapMarker[] = (data?.incidents ?? []).map(inc => ({
    id: `inc-${inc.id}`,
    lat: inc.lat,
    lng: inc.lon,
    color: SEV_COLOR[inc.severity] ?? '#888',
    label: `${inc.type} — ${inc.severity} [${inc.zone}]`,
    size: 14,
    data: inc as unknown as Record<string, unknown>,
  }));

  const userMarkers: MapMarker[] = (data?.users ?? []).map(u => ({
    id: `user-${u.user_id}`,
    lat: u.lat,
    lng: u.lon,
    color: '#60a5fa',
    label: `User in ${u.zone}`,
    size: 8,
  }));

  const heatmapPoints: HeatmapPoint[] = (data?.incidents ?? [])
    .filter(inc => inc.lat && inc.lon)
    .map(inc => ({ lat: inc.lat, lng: inc.lon, weight: SEV_WEIGHT[inc.severity] ?? 0.3 }))
    .concat(
      (data?.users ?? []).map(u => ({ lat: u.lat, lng: u.lon, weight: 0.15 }))
    );

  // zone congestion scores
  type ZoneStat = { score: number; incidents: number; users: number };
  const zoneMap: Record<string, ZoneStat> = {};
  for (const inc of data?.incidents ?? []) {
    const z = inc.zone ?? 'Unknown';
    if (!zoneMap[z]) zoneMap[z] = { score: 0, incidents: 0, users: 0 };
    zoneMap[z].score += SEV_WEIGHT[inc.severity] ?? 0.3;
    zoneMap[z].incidents++;
  }
  for (const u of data?.users ?? []) {
    const z = u.zone ?? 'Unknown';
    if (!zoneMap[z]) zoneMap[z] = { score: 0, incidents: 0, users: 0 };
    zoneMap[z].users++;
    zoneMap[z].score += 0.05;
  }
  const zoneCongestion = Object.entries(zoneMap)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 8);

  return (
    <AdminLayout title="Camp Map" subtitle="Redemption City · live · congestion overlay">
      <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 156px)' }}>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <CampMap
            markers={showUsers ? [...incidentMarkers, ...userMarkers] : incidentMarkers}
            lines={[]}
            heatmapPoints={showHeatmap ? heatmapPoints : []}
            boundary={boundaryData as any}
            onMarkerClick={m => m.id.startsWith('inc') && setSelectedIncident(m)}
            height="100%"
          />

          <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              style={{
                background: showHeatmap ? 'rgba(239,68,68,0.85)' : 'rgba(13,13,24,0.85)',
                color: '#fff', border: 'none', padding: '6px 12px',
                borderRadius: 8, fontSize: 13, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
            </button>
            <button
              onClick={() => setShowUsers(!showUsers)}
              style={{
                background: showUsers ? '#60a5fa' : 'rgba(13,13,24,0.85)',
                color: '#fff', border: 'none', padding: '6px 12px',
                borderRadius: 8, fontSize: 13, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
            >
              {showUsers ? 'Hide Users' : 'Show Users'}
            </button>
          </div>

          {error && (
            <div style={{
              position: 'absolute', top: 48, left: 12, right: 12,
              padding: '8px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.9)', color: '#fff',
              fontSize: 12, zIndex: 10,
            }}>{error}</div>
          )}

          {loading && !data && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--textMuted)', fontSize: 13, zIndex: 10,
            }}>Loading live data…</div>
          )}

          {/* Congestion alert banner */}
          {alert && (
            <div style={{
              position: 'absolute', top: 48, left: 12, right: 12, zIndex: 20,
              padding: '10px 16px', borderRadius: 8,
              background: alert.severity === 'critical' ? 'rgba(239,68,68,0.92)' : 'rgba(249,115,22,0.92)',
              color: '#fff', fontSize: 13,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Congestion alert — {alert.zone} ({alert.severity})</span>
              <button onClick={() => setAlert(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>&times;</button>
            </div>
          )}

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16, zIndex: 10,
            background: 'rgba(13,13,24,0.90)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '8px 14px',
            display: 'flex', gap: 14, alignItems: 'center',
          }}>
            {([
              ['Critical', '#EF4444'],
              ['High',     '#F97316'],
              ['Medium',   '#EAB308'],
              ['Low',      '#22C55E'],
              ['User',     '#60a5fa'],
            ] as [string, string][]).map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
              </div>
            ))}
            {showHeatmap && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 4, paddingLeft: 10, borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ width: 28, height: 8, borderRadius: 4, background: 'linear-gradient(to right, rgba(234,179,8,0.5), rgba(249,115,22,0.7), rgba(239,68,68,0.9))' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>Density</span>
              </div>
            )}
          </div>

          {/* Selected incident popup */}
          {selectedIncident && (
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 10,
              background: 'rgba(13,13,24,0.95)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: 14, maxWidth: 240,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{String(selectedIncident.data?.type ?? 'Incident')}</span>
                <button onClick={() => setSelectedIncident(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16, padding: 0 }}>&times;</button>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>Severity: <span style={{ color: SEV_COLOR[String(selectedIncident.data?.severity ?? '')] ?? '#fff', fontWeight: 600 }}>{String(selectedIncident.data?.severity ?? '—')}</span></div>
                <div>Status: {String(selectedIncident.data?.status ?? '—')}</div>
                <div>Zone: {String(selectedIncident.data?.zone ?? '—')}</div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* Congestion zones */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>
              Congestion Zones
              <span style={{ float: 'right', fontSize: 11, color: 'var(--textMuted)', fontWeight: 400 }}>
                {data?.users.length ?? 0} active users
              </span>
            </div>
            {zoneCongestion.length === 0 ? (
              <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--textMuted)', fontSize: 12 }}>No zone data</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {zoneCongestion.map(([zone, stat]) => {
                  const { label, color } = congestionLabel(stat.score);
                  const maxScore = Math.max(...zoneCongestion.map(([, s]) => s.score), 1);
                  return (
                    <div key={zone}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--textSub)' }}>{zone}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, color: 'var(--textMuted)' }}>{stat.incidents} inc · {stat.users} users</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '20', padding: '1px 7px', borderRadius: 4 }}>{label}</span>
                        </div>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${(stat.score / maxScore) * 100}%`, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Open incidents list */}
          <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-title">Open Reports ({incidentMarkers.length})</div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {incidentMarkers.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--textMuted)', fontSize: 12 }}>No open incidents</div>
              ) : (
                incidentMarkers.slice(0, 20).map(m => (
                  <div
                    key={m.id}
                    onClick={() => setSelectedIncident(m)}
                    style={{
                      padding: '10px 12px', borderRadius: 10,
                      background: selectedIncident?.id === m.id ? 'var(--surfaceHi)' : 'var(--surface2)',
                      border: `1px solid ${selectedIncident?.id === m.id ? m.color + '55' : 'var(--border)'}`,
                      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0, boxShadow: `0 0 6px ${m.color}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.label?.split(' —')[0] ?? 'Incident'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--textMuted)', marginTop: 1 }}>{String(m.data?.zone ?? 'Unknown')}</div>
                    </div>
                    <span style={{ fontSize: 10, color: m.color, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                      {String(m.data?.severity ?? '')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
