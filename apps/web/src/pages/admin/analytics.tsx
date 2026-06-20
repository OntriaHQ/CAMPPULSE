import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { fetchDashboardSummary, fetchIncidentList, fetchIncidentHotspots, fetchEquityMetrics } from '../../services/admin';
import type { DashboardSummary, HotspotType, EquityMetricType, IncidentType } from '../../services/admin';

export default function AdminAnalyticsPage() {
  const [summary,  setSummary]  = useState<DashboardSummary | null>(null);
  const [hotspots, setHotspots] = useState<HotspotType[]>([]);
  const [equity,   setEquity]   = useState<EquityMetricType[]>([]);
  const [incidents, setIncidents] = useState<IncidentType[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    Promise.all([
      fetchDashboardSummary(),
      fetchIncidentHotspots(),
      fetchEquityMetrics(),
      fetchIncidentList(undefined, undefined, 200),
    ])
      .then(([s, h, e, incs]) => {
        setSummary(s);
        setHotspots(h);
        setEquity(e);
        setIncidents(incs);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AdminLayout title="Analytics" subtitle="Issue trends across Redemption City">
        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>Loading analytics...</div>
      </AdminLayout>
    );
  }

  const byType: Record<string, number> = {};
  const byArea: Record<string, number> = {};
  const severityBreak: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  incidents.forEach(inc => {
    byType[inc.type] = (byType[inc.type] || 0) + 1;
    const z = inc.zone ?? 'Unknown';
    byArea[z] = (byArea[z] || 0) + 1;
    const sev = inc.severity || 'low';
    severityBreak[sev] = (severityBreak[sev] || 0) + 1;
  });

  const maxType = Math.max(...Object.values(byType), 1);
  const maxArea = Math.max(...Object.values(byArea), 1);
  const totalSev = Object.values(severityBreak).reduce((a, b) => a + b, 0) || 1;

  const STATS = summary ? [
    { label: 'Total Reports',  value: String(summary.totalIncidents), delta: `${summary.openIncidents} open`, dir: 'down' },
    { label: 'Active Zones',   value: String(summary.activeZones),    delta: `${summary.congestionZonesCount} congested`, dir: summary.congestionZonesCount > 0 ? 'down' : 'up' },
    { label: 'Open Incidents', value: String(summary.openIncidents), delta: `${summary.inProgressIncidents} in progress`, dir: 'down' },
    { label: 'Resolution Rate', value: summary.totalIncidents > 0 ? `${Math.round((1 - summary.openIncidents / summary.totalIncidents) * 100)}%` : '0%', delta: 'vs total', dir: 'up' },
  ] : [];

  const BY_AREA = Object.entries(byArea)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([label, count]) => ({
      label,
      count,
      pct: count / maxArea,
      color: count > 10 ? '#EF4444' : count > 5 ? '#F97316' : count > 2 ? '#EAB308' : '#22C55E',
    }));

  const BY_TYPE = Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8)
    .map(([label, count]) => ({ label, count, pct: count / maxType }));

  const SEVERITY = [
    { label: 'Critical', count: severityBreak.critical, color: '#EF4444', pct: severityBreak.critical / totalSev },
    { label: 'High',     count: severityBreak.high,     color: '#F97316', pct: severityBreak.high / totalSev },
    { label: 'Medium',   count: severityBreak.medium,   color: '#EAB308', pct: severityBreak.medium / totalSev },
    { label: 'Low',      count: severityBreak.low,      color: '#22C55E', pct: severityBreak.low / totalSev },
  ];

  return (
    <AdminLayout title="Analytics" subtitle="Issue trends across Redemption City">
      {error && <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, color: '#EF4444', fontSize: 13 }}>{error}</div>}

      <div className="stats-grid mb-6">
        {STATS.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className={`stat-delta ${s.dir}`}>{s.delta}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Reports by Area</div>
          <div className="bar-chart">
            {BY_AREA.map(b => (
              <div key={b.label} className="bar-row">
                <span className="bar-label">{b.label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${b.pct * 100}%`, background: b.color }} />
                </div>
                <span className="bar-value" style={{ color: b.color }}>{b.count}</span>
              </div>
            ))}
            {BY_AREA.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>No data</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Reports by Issue Type</div>
          <div className="bar-chart">
            {BY_TYPE.map(b => (
              <div key={b.label} className="bar-row">
                <span className="bar-label">{b.label}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${b.pct * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accentEnd))' }} />
                </div>
                <span className="bar-value">{b.count}</span>
              </div>
            ))}
            {BY_TYPE.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>No data</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Severity Breakdown</div>
          {SEVERITY.map(s => (
            <div key={s.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>{s.label}</span>
                <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{s.count} ({Math.round(s.pct * 100)}%)</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: s.color, width: `${s.pct * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title">Incident Hotspots</div>
          <div className="bar-chart">
            {hotspots.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>No hotspot data</div>
            ) : (
              hotspots.map(h => (
                <div key={h.zone} className="bar-row">
                  <span className="bar-label">{h.zone}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{
                      width: `${Math.min(h.incidentCount / Math.max(...hotspots.map(x => x.incidentCount), 1) * 100, 100)}%`,
                      background: 'linear-gradient(90deg, var(--accent), var(--accentEnd))',
                    }} />
                  </div>
                  <span className="bar-value">{h.incidentCount}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {equity.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-title">Equity Metrics — Avg Resolution Time by Zone</div>
          <div className="bar-chart">
            {equity.map(e => (
              <div key={e.zone} className="bar-row">
                <span className="bar-label">{e.zone}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{
                    width: `${Math.min(e.avgResolutionTimeMinutes / Math.max(...equity.map(x => x.avgResolutionTimeMinutes), 1) * 100, 100)}%`,
                    background: 'linear-gradient(90deg, var(--accent), var(--accentEnd))',
                  }} />
                </div>
                <span className="bar-value">{Math.round(e.avgResolutionTimeMinutes)}m</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
