import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { fetchDashboardSummary, fetchIncidentList } from '../../services/admin';
import type { DashboardSummary, IncidentType } from '../../services/admin';

const SEV_CLASS: Record<string, string> = {
  critical: 'pill-critical', high: 'pill-high', medium: 'pill-medium', low: 'pill-low',
};

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recent,  setRecent]  = useState<IncidentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    Promise.all([
      fetchDashboardSummary(),
      fetchIncidentList(undefined, undefined, 5),
    ])
      .then(([s, incidents]) => {
        setSummary(s);
        setRecent(incidents);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const zoneCounts: Record<string, number> = {};
  recent.forEach(r => {
    const z = r.zone ?? 'Unknown';
    zoneCounts[z] = (zoneCounts[z] || 0) + 1;
  });
  const AREAS = Object.entries(zoneCounts).map(([name, count]) => ({
    name,
    count,
    fill: Math.min(count / (Math.max(...Object.values(zoneCounts), 1)), 1),
    color: count > 3 ? 'var(--critical)' : count > 1 ? 'var(--high)' : 'var(--medium)',
  }));

  const STATS = summary ? [
    { label: 'Total Reports',    value: String(summary.total_incidents), delta: `${summary.open_incidents} open`, dir: 'down' },
    { label: 'Open',             value: String(summary.open_incidents),  delta: `${summary.in_progress_incidents} in progress`, dir: 'down' },
    { label: 'Active Zones',     value: String(summary.active_zones),   delta: `${summary.congestion_zones_count} congested`, dir: summary.congestion_zones_count > 0 ? 'down' : 'up' },
    { label: 'Congestion Zones', value: String(summary.congestion_zones_count), delta: 'flagged areas', dir: summary.congestion_zones_count > 0 ? 'down' : 'up' },
  ] : [];

  return (
    <AdminLayout title="Overview" subtitle="Redemption City · Camp Services">
      {error && <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, color: '#EF4444', fontSize: 13 }}>{error}</div>}

      {loading ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>Loading dashboard...</div>
      ) : (
        <>
          <div className="stats-grid">
            {STATS.map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
                <div className={`stat-delta ${s.dir}`}>{s.delta}</div>
              </div>
            ))}
          </div>

          <div className="grid-2">
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="flex items-center justify-between mb-4">
                <span className="card-title" style={{ marginBottom: 0 }}>Recent Reports</span>
                <a href="/admin/incidents" className="btn btn-outline btn-sm">View all</a>
              </div>
              <div className="recent-list">
                {recent.length === 0 && (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>No recent reports</div>
                )}
                {recent.map(r => (
                  <div key={r.id} className="recent-item">
                    <div className="recent-stripe" style={{ background: `var(--${r.severity === 'critical' ? 'critical' : r.severity === 'high' ? 'high' : r.severity === 'medium' ? 'medium' : 'low'})` }} />
                    <div className="flex-1">
                      <div className="recent-type">{r.type}</div>
                      <div className="recent-loc">{r.address_label ?? `${r.location?.lat?.toFixed(3)}, ${r.location?.lon?.toFixed(3)}`} · {r.zone ?? 'Unknown'}</div>
                    </div>
                    <span className={`pill ${SEV_CLASS[r.severity]}`}>
                      <span className="pill-dot" style={{ background: 'currentColor' }} />
                      {r.severity}
                    </span>
                    <div className="recent-ago">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Activity by Area</div>
              <div className="zone-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {AREAS.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', padding: 20, textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>No activity data</div>
                ) : (
                  AREAS.map(a => (
                    <div key={a.name} className="zone-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="zone-name">{a.name}</span>
                        <span className="pill" style={{ color: a.color, background: a.color + '18', borderColor: a.color + '40', fontSize: 10 }}>
                          {a.count} open
                        </span>
                      </div>
                      <div className="zone-bar-track">
                        <div className="zone-bar-fill" style={{ width: `${a.fill * 100}%`, background: a.color }} />
                      </div>
                      <div style={{ color: a.color, fontSize: 11, fontWeight: 600 }}>
                        {Math.round(a.fill * 100)}% activity level
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
