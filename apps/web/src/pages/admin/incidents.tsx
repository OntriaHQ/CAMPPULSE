import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { fetchIncidentList, gqlUpdateIncidentStatus } from '../../services/admin';
import type { IncidentType } from '../../services/admin';

const SEV_CLASS: Record<string, string>  = { critical: 'pill-critical', high: 'pill-high', medium: 'pill-medium', low: 'pill-low' };
const STAT_CLASS: Record<string, string> = { submitted: 'pill-muted', assigned: 'pill-active', in_progress: 'pill-high', resolved: 'pill-resolved', closed: 'pill-muted' };
const STAT_LABEL: Record<string, string> = { submitted: 'Submitted', assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };

const AREAS = ['Auditorium', 'North Gate', 'Festival Arena', 'Canaan Land', 'South Camp', 'Camp Road'];

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentType[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [search,   setSearch]   = useState('');
  const [severity, setSeverity] = useState('');
  const [status,   setStatus]   = useState('');
  const [area,     setArea]     = useState('');

  useEffect(() => {
    setLoading(true);
    fetchIncidentList()
      .then(setIncidents)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleResolve(id: string) {
    try {
      await gqlUpdateIncidentStatus(id, 'resolved');
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: 'resolved' as const } : i));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleAssign(id: string) {
    try {
      await gqlUpdateIncidentStatus(id, 'assigned');
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: 'assigned' as const } : i));
    } catch (e: any) {
      setError(e.message);
    }
  }

  const filtered = incidents.filter(r => {
    if (search   && !r.type.toLowerCase().includes(search.toLowerCase()) && !(r.address_label?.toLowerCase().includes(search.toLowerCase()))) return false;
    if (severity && r.severity !== severity) return false;
    if (status   && r.status   !== status)   return false;
    if (area     && r.zone     !== area)     return false;
    return true;
  });

  return (
    <AdminLayout title="Reports" subtitle={`${filtered.length} reports · Redemption City`}>
      {error && <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, color: '#EF4444', fontSize: 13 }}>{error}</div>}

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
        {loading ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>Loading reports...</div>
        ) : (
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
                  <td style={{ color: 'var(--textMuted)', fontSize: 12 }}>{r.id.slice(0, 8)}</td>
                  <td className="primary">{r.type}</td>
                  <td>
                    {r.address_label ?? `${r.location?.lat.toFixed(4)}, ${r.location?.lon.toFixed(4)}`}
                    <br /><span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{r.zone ?? ''}</span>
                  </td>
                  <td>
                    <span className={`pill ${SEV_CLASS[r.severity]}`}>
                      <span className="pill-dot" style={{ background: 'currentColor' }} />
                      {r.severity}
                    </span>
                  </td>
                  <td><span className={`pill ${STAT_CLASS[r.status]}`}>{STAT_LABEL[r.status] ?? r.status}</span></td>
                  <td>{r.reporter_name ?? 'Anonymous'}</td>
                  <td style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.status === 'submitted' && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleAssign(r.id)}>Assign</button>
                      )}
                      {(r.status === 'assigned' || r.status === 'in_progress') && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleResolve(r.id)}>Resolve</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>
            No reports match the current filters.
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
