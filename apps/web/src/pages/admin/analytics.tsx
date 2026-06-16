import { AdminLayout } from '../../components/layout/AdminLayout';

const TREND = [
  { day: 'Mon', count: 18 },
  { day: 'Tue', count: 24 },
  { day: 'Wed', count: 31 },
  { day: 'Thu', count: 22 },
  { day: 'Fri', count: 41 },
  { day: 'Sat', count: 38 },
  { day: 'Sun', count: 27 },
];

const BY_TYPE = [
  { label: 'Flooding',         count: 41, pct: 0.88 },
  { label: 'Crowd Congestion', count: 28, pct: 0.60 },
  { label: 'Streetlight Out',  count: 22, pct: 0.47 },
  { label: 'Water Supply',     count: 18, pct: 0.39 },
  { label: 'Road Damage',      count: 11, pct: 0.24 },
  { label: 'Power Outage',     count: 7,  pct: 0.15 },
];

const BY_AREA = [
  { label: 'Auditorium',     count: 47, pct: 1.00, color: '#EF4444' },
  { label: 'North Gate',     count: 31, pct: 0.66, color: '#F97316' },
  { label: 'Festival Arena', count: 29, pct: 0.62, color: '#EAB308' },
  { label: 'Canaan Land',    count: 20, pct: 0.43, color: '#22C55E' },
];

const STATS = [
  { label: 'Total This Week',   value: '201', delta: '+18% vs last service', dir: 'down' },
  { label: 'Avg. Response',     value: '14m',  delta: '-3m improvement',      dir: 'up'  },
  { label: 'Resolution Rate',   value: '70%',  delta: '+5% vs last week',     dir: 'up'  },
  { label: 'Unresolved Critical', value: '8',  delta: '2 need escalation',    dir: 'down' },
];

const maxTrend = Math.max(...TREND.map(t => t.count));

export default function AdminAnalyticsPage() {
  return (
    <AdminLayout title="Analytics" subtitle="Issue trends across Redemption City">
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
        {/* Daily volume */}
        <div className="card">
          <div className="card-title">Daily Reports (This Week)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, marginBottom: 10 }}>
            {TREND.map(t => (
              <div key={t.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--textSub)' }}>{t.count}</span>
                <div style={{
                  width: '100%', borderRadius: 6,
                  height: `${(t.count / maxTrend) * 110}px`,
                  background: 'linear-gradient(180deg, var(--accent), var(--accentEnd))',
                  opacity: 0.85,
                }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {TREND.map(t => (
              <div key={t.day} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--textMuted)', fontWeight: 500 }}>
                {t.day}
              </div>
            ))}
          </div>
        </div>

        {/* By area */}
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
          </div>
        </div>

        {/* By type */}
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
          </div>
        </div>

        {/* Severity breakdown */}
        <div className="card">
          <div className="card-title">Severity Breakdown</div>
          {[
            { label: 'Critical', count: 34, color: '#EF4444', pct: 0.27 },
            { label: 'High',     count: 52, color: '#F97316', pct: 0.41 },
            { label: 'Medium',   count: 28, color: '#EAB308', pct: 0.22 },
            { label: 'Low',      count: 13, color: '#22C55E', pct: 0.10 },
          ].map(s => (
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
      </div>
    </AdminLayout>
  );
}
