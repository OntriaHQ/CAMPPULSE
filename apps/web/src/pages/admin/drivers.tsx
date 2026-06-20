import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { fetchLiveDrivers, fetchLiveMapData } from '../../services/drivers';
import type { LiveDriver } from '../../services/drivers';
import { useGuestWebSocket } from '../../hooks/useWebSocket';

const STATUS_CLASS: Record<string, string> = { active: 'pill-resolved', en_route: 'pill-active', idle: 'pill-muted' };
const STATUS_LABEL: Record<string, string> = { active: 'Active', en_route: 'En Route', idle: 'Available' };

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'en_route', label: 'En Route' },
  { key: 'idle', label: 'Available' },
];

function getDriverStatus(driver: LiveDriver): string {
  return driver.zone ? 'active' : 'idle';
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export default function AdminResponseTeamsPage() {
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [zoneIncidentCounts, setZoneIncidentCounts] = useState<Record<string, number>>({});

  const { subscribe } = useGuestWebSocket();

  const refresh = useCallback(() => {
    fetchLiveDrivers()
      .then(drivers => {
        setDrivers(drivers);
        setLastUpdated(new Date());
        setError('');
      })
      .catch(e => setError(e.message));
  }, []);

  const refreshMapData = useCallback(() => {
    fetchLiveMapData()
      .then(data => {
        const counts: Record<string, number> = {};
        for (const inc of data.incidents) {
          if (inc.zone) counts[inc.zone] = (counts[inc.zone] ?? 0) + 1;
        }
        setZoneIncidentCounts(counts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
    refreshMapData();
    setLoading(false);

    const interval = setInterval(() => {
      refresh();
      refreshMapData();
    }, 15000);

    return () => clearInterval(interval);
  }, [refresh, refreshMapData]);

  useEffect(() => {
    const unsub = subscribe('*', () => {
      refresh();
      refreshMapData();
    });
    return () => unsub?.();
  }, [subscribe, refresh, refreshMapData]);

  const filteredDrivers = statusFilter === 'all'
    ? drivers
    : drivers.filter(d => getDriverStatus(d) === statusFilter);

  const uniqueZones = new Set(drivers.map(d => d.zone)).size;
  const avgPerZone = uniqueZones > 0 ? (drivers.length / uniqueZones).toFixed(1) : '0';

  return (
    <AdminLayout title="Response Teams" subtitle={`${filteredDrivers.length} active · Redemption City`}>
      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, color: '#EF4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div className="stats-grid mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Active Now</div>
          <div className="stat-value">{drivers.length}</div>
          <div className="stat-delta">Live from Redis</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unique Zones</div>
          <div className="stat-value" style={{ color: 'var(--low)' }}>{uniqueZones}</div>
          <div className="stat-delta up">Covered areas</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last Updated</div>
          <div className="stat-value" style={{ fontSize: 16, color: 'var(--accentEnd)' }}>{timeAgo(lastUpdated.toISOString())}</div>
          <div className="stat-delta">Auto-refresh 15s</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg per Zone</div>
          <div className="stat-value" style={{ color: 'var(--accent)' }}>{avgPerZone}</div>
          <div className="stat-delta">Distribution ratio</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTER_TABS.map(f => (
          <button
            key={f.key}
            className={`pill ${statusFilter === f.key ? 'pill-resolved' : 'pill-muted'}`}
            style={{ cursor: 'pointer', border: 'none', fontSize: 13, padding: '4px 14px' }}
            onClick={() => setStatusFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {loading ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>
            Loading live drivers...
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Driver</th>
                <th>Location</th>
                <th>Zone</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>
                    No drivers currently active
                  </td>
                </tr>
              ) : (
                filteredDrivers.map(d => {
                  const status = getDriverStatus(d);
                  const isExpanded = expandedId === d.user_id;
                  const nearbyCount = d.zone ? (zoneIncidentCounts[d.zone] ?? 0) : 0;
                  return (
                    <tr key={d.user_id} onClick={() => setExpandedId(isExpanded ? null : d.user_id)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, var(--accent), var(--accentEnd))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, color: '#fff',
                          }}>
                            {d.user_id.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Driver</div>
                            <div style={{ fontSize: 11, color: 'var(--textMuted)' }}>{d.user_id.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{d.lat.toFixed(4)}, {d.lon.toFixed(4)}</td>
                      <td>{d.zone ?? '—'}</td>
                      <td>
                        <span className={`pill ${STATUS_CLASS[status]}`}>
                          <span className="pill-dot" style={{ background: 'currentColor' }} />
                          {STATUS_LABEL[status]}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{timeAgo(d.timestamp)}</td>
                      <td style={{ fontSize: 11, color: 'var(--textMuted)', textAlign: 'right' }}>
                        {isExpanded ? '▲' : '▼'}
                      </td>
                    </tr>
                  );
                })
              )}
              {filteredDrivers.map(d => {
                if (expandedId !== d.user_id) return null;
                const nearbyCount = d.zone ? (zoneIncidentCounts[d.zone] ?? 0) : 0;
                return (
                  <tr key={`${d.user_id}-detail`}>
                    <td colSpan={6} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'flex', gap: 24, alignItems: 'center', fontSize: 13 }}>
                        <div>
                          <span style={{ color: 'var(--textMuted)' }}>Last ping: </span>
                          <span>{timeAgo(d.timestamp)}</span>
                        </div>
                        <div>
                          <span style={{ color: 'var(--textMuted)' }}>Nearby incidents: </span>
                          <span className={`pill ${nearbyCount > 0 ? 'pill-high' : 'pill-muted'}`}
                            style={{ fontSize: 11, padding: '1px 8px' }}
                          >
                            {nearbyCount}
                          </span>
                        </div>
                        <a
                          href={`/admin/map?focus=${d.lat},${d.lon}`}
                          className="btn btn-outline btn-sm"
                          style={{ marginLeft: 'auto', textDecoration: 'none' }}
                          onClick={e => e.stopPropagation()}
                        >
                          View on Map
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
