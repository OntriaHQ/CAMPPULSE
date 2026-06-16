import { AdminLayout } from '../../components/layout/AdminLayout';

const TEAMS = [
  { id: 'T-01', name: 'Camp Maintenance',     area: 'Camp Road',      unit: 'Pickup Van · CM-01', status: 'active',   reports: 4, lastSeen: '2 min ago'  },
  { id: 'T-02', name: 'Infrastructure Team',  area: 'Auditorium',     unit: 'Service Van · IF-02', status: 'active',   reports: 2, lastSeen: '5 min ago'  },
  { id: 'T-03', name: 'Medical Response',     area: 'Festival Arena', unit: 'Ambulance · MR-01',  status: 'en_route', reports: 1, lastSeen: '1 min ago'  },
  { id: 'T-04', name: 'Security Team',        area: 'North Gate',     unit: 'Patrol Car · SC-04', status: 'active',   reports: 3, lastSeen: '3 min ago'  },
  { id: 'T-05', name: 'Sanitation Crew',      area: 'South Camp',     unit: 'Service Truck · ST-02', status: 'idle',  reports: 0, lastSeen: '18 min ago' },
  { id: 'T-06', name: 'Traffic Control',      area: 'North Gate',     unit: 'On foot · TC-06',    status: 'active',   reports: 2, lastSeen: '4 min ago'  },
];

const STATUS_CLASS: Record<string, string> = { active: 'pill-resolved', en_route: 'pill-active', idle: 'pill-muted' };
const STATUS_LABEL: Record<string, string> = { active: 'Active', en_route: 'En Route', idle: 'Available' };

export default function AdminResponseTeamsPage() {
  return (
    <AdminLayout title="Response Teams" subtitle={`${TEAMS.filter(t => t.status !== 'idle').length} of ${TEAMS.length} deployed`}>
      <div className="stats-grid mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Total Teams</div>
          <div className="stat-value">{TEAMS.length}</div>
          <div className="stat-delta">On roster</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value" style={{ color: 'var(--low)' }}>{TEAMS.filter(t => t.status === 'active').length}</div>
          <div className="stat-delta up">Responding now</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">En Route</div>
          <div className="stat-value" style={{ color: 'var(--accentEnd)' }}>{TEAMS.filter(t => t.status === 'en_route').length}</div>
          <div className="stat-delta">Dispatched</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Area</th>
              <th>Unit / Vehicle</th>
              <th>Status</th>
              <th>Open Reports</th>
              <th>Last Update</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {TEAMS.map(t => (
              <tr key={t.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--accent), var(--accentEnd))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: '#fff',
                    }}>
                      {t.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--textMuted)' }}>{t.id}</div>
                    </div>
                  </div>
                </td>
                <td>{t.area}</td>
                <td style={{ fontSize: 12 }}>{t.unit}</td>
                <td><span className={`pill ${STATUS_CLASS[t.status]}`}>{STATUS_LABEL[t.status]}</span></td>
                <td>
                  <span style={{ fontSize: 13, fontWeight: 600, color: t.reports > 2 ? 'var(--high)' : t.reports > 0 ? 'var(--medium)' : 'var(--textMuted)' }}>
                    {t.reports}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>{t.lastSeen}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm">Assign</button>
                    <button className="btn btn-outline btn-sm">Contact</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
