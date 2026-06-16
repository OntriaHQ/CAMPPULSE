import { AdminLayout } from '../../components/layout/AdminLayout';

const STATS = [
  { label: 'Total Reports',    value: '127', delta: '+12 today',          dir: 'down' },
  { label: 'Open',             value: '34',  delta: '8 need attention',   dir: 'down' },
  { label: 'Resolved',         value: '89',  delta: '+24 this week',       dir: 'up'  },
  { label: 'Avg. Resolution',  value: '41m', delta: '-8m vs last event',   dir: 'up'  },
];

const RECENT = [
  { id: 'RPT-041', type: 'Flooding',          area: 'Camp Road',        location: 'Near Medical Centre', severity: 'critical', ago: '2h ago'  },
  { id: 'RPT-040', type: 'Crowd Congestion',  area: 'North Gate',       location: 'Expressway Entrance', severity: 'high',     ago: '45m ago' },
  { id: 'RPT-039', type: 'Streetlight Out',   area: 'Festival Arena',   location: 'East Pathway',        severity: 'medium',   ago: '3h ago'  },
  { id: 'RPT-038', type: 'Water Supply',      area: 'Canaan Land',      location: 'Block C Estate',      severity: 'high',     ago: '5h ago'  },
  { id: 'RPT-037', type: 'Road Damage',       area: 'South Camp',       location: 'Access Road 2',       severity: 'medium',   ago: '6h ago'  },
];

const AREAS = [
  { name: 'Auditorium',     count: 12, fill: 0.82, color: 'var(--critical)' },
  { name: 'North Gate',     count: 5,  fill: 0.42, color: 'var(--high)'     },
  { name: 'Festival Arena', count: 8,  fill: 0.62, color: 'var(--medium)'   },
  { name: 'Canaan Land',    count: 2,  fill: 0.18, color: 'var(--low)'      },
];

const SEV_CLASS: Record<string, string> = {
  critical: 'pill-critical', high: 'pill-high', medium: 'pill-medium', low: 'pill-low',
};

export default function AdminDashboardPage() {
  return (
    <AdminLayout title="Overview" subtitle="Redemption City · Camp Services">
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
        {/* Recent reports */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="flex items-center justify-between mb-4">
            <span className="card-title" style={{ marginBottom: 0 }}>Recent Reports</span>
            <a href="/admin/incidents" className="btn btn-outline btn-sm">View all</a>
          </div>
          <div className="recent-list">
            {RECENT.map(r => (
              <div key={r.id} className="recent-item">
                <div className="recent-stripe" style={{ background: `var(--${r.severity === 'critical' ? 'critical' : r.severity === 'high' ? 'high' : r.severity === 'medium' ? 'medium' : 'low'})` }} />
                <div className="flex-1">
                  <div className="recent-type">{r.type}</div>
                  <div className="recent-loc">{r.location} · {r.area}</div>
                </div>
                <span className={`pill ${SEV_CLASS[r.severity]}`}>
                  <span className="pill-dot" style={{ background: 'currentColor' }} />
                  {r.severity}
                </span>
                <div className="recent-ago">{r.ago}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Area activity */}
        <div className="card">
          <div className="card-title">Activity by Area</div>
          <div className="zone-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {AREAS.map(a => (
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
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
