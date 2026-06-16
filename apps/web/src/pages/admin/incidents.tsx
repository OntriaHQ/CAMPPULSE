import { useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';

type Status   = 'submitted' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
type Severity = 'critical' | 'high' | 'medium' | 'low';

interface Report {
  id: string; type: string; area: string; location: string;
  severity: Severity; status: Status; reporter: string; ago: string;
}

const REPORTS: Report[] = [
  { id: 'RPT-041', type: 'Flooding',         area: 'Camp Road',      location: 'Near Medical Centre',   severity: 'critical', status: 'in_progress', reporter: 'Juls O.',    ago: '2h ago'    },
  { id: 'RPT-040', type: 'Crowd Congestion', area: 'North Gate',     location: 'Expressway Entrance',   severity: 'high',     status: 'assigned',    reporter: 'Tunde M.',   ago: '45m ago'   },
  { id: 'RPT-039', type: 'Streetlight Out',  area: 'Festival Arena', location: 'East Pathway',          severity: 'medium',   status: 'submitted',   reporter: 'Amaka E.',   ago: '3h ago'    },
  { id: 'RPT-038', type: 'Water Supply',     area: 'Canaan Land',    location: 'Block C Estate',        severity: 'high',     status: 'in_progress', reporter: 'Emeka K.',   ago: '5h ago'    },
  { id: 'RPT-037', type: 'Road Damage',      area: 'South Camp',     location: 'Access Road 2',         severity: 'medium',   status: 'assigned',    reporter: 'Sola A.',    ago: '6h ago'    },
  { id: 'RPT-036', type: 'Power Outage',     area: 'Auditorium',     location: 'Block D Corridor',      severity: 'critical', status: 'in_progress', reporter: 'Bisi F.',    ago: 'Yesterday' },
  { id: 'RPT-035', type: 'Sanitation',       area: 'Festival Arena', location: 'Public Toilets, Row 4', severity: 'medium',   status: 'resolved',    reporter: 'Kemi L.',    ago: 'Yesterday' },
  { id: 'RPT-034', type: 'Lost Person',      area: 'North Gate',     location: 'Gate B Waiting Area',   severity: 'high',     status: 'resolved',    reporter: 'Femi O.',    ago: '2d ago'    },
  { id: 'RPT-033', type: 'Flooding',         area: 'South Camp',     location: 'Behind RCCG School',    severity: 'high',     status: 'closed',      reporter: 'Grace N.',   ago: '2d ago'    },
  { id: 'RPT-032', type: 'Facility Damage',  area: 'Canaan Land',    location: 'Estate Fence, East',    severity: 'low',      status: 'closed',      reporter: 'Daniel A.',  ago: '3d ago'    },
];

const SEV_CLASS: Record<string, string>  = { critical: 'pill-critical', high: 'pill-high', medium: 'pill-medium', low: 'pill-low' };
const STAT_CLASS: Record<string, string> = { submitted: 'pill-muted', assigned: 'pill-active', in_progress: 'pill-high', resolved: 'pill-resolved', closed: 'pill-muted' };
const STAT_LABEL: Record<string, string> = { submitted: 'Submitted', assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };

const AREAS = ['Camp Road', 'North Gate', 'Festival Arena', 'Canaan Land', 'South Camp', 'Auditorium'];

export default function AdminIncidentsPage() {
  const [search,   setSearch]   = useState('');
  const [severity, setSeverity] = useState('');
  const [status,   setStatus]   = useState('');
  const [area,     setArea]     = useState('');

  const filtered = REPORTS.filter(r => {
    if (search   && !r.type.toLowerCase().includes(search.toLowerCase()) && !r.location.toLowerCase().includes(search.toLowerCase())) return false;
    if (severity && r.severity !== severity) return false;
    if (status   && r.status   !== status)   return false;
    if (area     && r.area     !== area)     return false;
    return true;
  });

  return (
    <AdminLayout title="Reports" subtitle={`${filtered.length} reports · Redemption City`}>
      <div className="filter-bar">
        <div className="search-input-wrap">
          <span className="search-icon">S</span>
          <input
            className="input"
            placeholder="Search by issue type or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="filter-select" value={severity} onChange={e => setSeverity(e.target.value)}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select className="filter-select" value={area} onChange={e => setArea(e.target.value)}>
          <option value="">All areas</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <button className="btn btn-outline btn-sm" onClick={() => { setSearch(''); setSeverity(''); setStatus(''); setArea(''); }}>
          Clear
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Issue</th>
              <th>Location</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Reported by</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td style={{ color: 'var(--textMuted)', fontSize: 12 }}>{r.id}</td>
                <td className="primary">{r.type}</td>
                <td>{r.location}<br /><span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{r.area}</span></td>
                <td>
                  <span className={`pill ${SEV_CLASS[r.severity]}`}>
                    <span className="pill-dot" style={{ background: 'currentColor' }} />
                    {r.severity}
                  </span>
                </td>
                <td><span className={`pill ${STAT_CLASS[r.status]}`}>{STAT_LABEL[r.status]}</span></td>
                <td>{r.reporter}</td>
                <td style={{ fontSize: 12 }}>{r.ago}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-outline btn-sm">Assign</button>
                    <button className="btn btn-outline btn-sm">Resolve</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>
            No reports match the current filters.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
