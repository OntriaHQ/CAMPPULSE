import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { fetchIncidentList, gqlUpdateIncidentStatus, gqlAssignIncident, gqlBulkUpdateIncidentStatus } from '../../services/admin';
import type { IncidentType } from '../../services/admin';

const SEV_CLASS: Record<string, string> = { critical: 'pill-critical', high: 'pill-high', medium: 'pill-medium', low: 'pill-low' };
const STAT_CLASS: Record<string, string> = { submitted: 'pill-muted', assigned: 'pill-active', in_progress: 'pill-high', resolved: 'pill-resolved', closed: 'pill-muted' };
const STAT_LABEL: Record<string, string> = { submitted: 'Submitted', assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };

const AREAS = ['Auditorium', 'North Gate', 'Festival Arena', 'Canaan Land', 'South Camp', 'Camp Road'];
const DEPARTMENTS = ['Security', 'Medical', 'Facilities', 'Logistics', 'Admin', 'Events'];

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 24,
};

const MODAL: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-xl)', padding: 24, maxWidth: 520, width: '100%',
  maxHeight: '90vh', overflowY: 'auto',
};

function Skeleton({ width = '100%', height = 14 }: { width?: string | number; height?: number }) {
  return (
    <div
      style={{
        width, height, borderRadius: 6,
        background: 'linear-gradient(90deg, var(--surface2) 25%, var(--surfaceHi) 50%, var(--surface2) 75%)',
        backgroundSize: '200px 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
      }}
    />
  );
}

function SkeletonRow() {
  return (
    <tr>
      <td style={{ padding: '13px 16px' }}><Skeleton width={18} height={14} /></td>
      <td style={{ padding: '13px 16px' }}><Skeleton width={56} height={12} /></td>
      <td style={{ padding: '13px 16px' }}><Skeleton width={100} height={14} /></td>
      <td style={{ padding: '13px 16px' }}><Skeleton width={150} height={14} /></td>
      <td style={{ padding: '13px 16px' }}><Skeleton width={66} height={22} /></td>
      <td style={{ padding: '13px 16px' }}><Skeleton width={76} height={22} /></td>
      <td style={{ padding: '13px 16px' }}><Skeleton width={70} height={14} /></td>
      <td style={{ padding: '13px 16px' }}><Skeleton width={60} height={12} /></td>
      <td style={{ padding: '13px 16px' }}><Skeleton width={120} height={28} /></td>
    </tr>
  );
}

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentType[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [search,   setSearch]   = useState('');
  const [severity, setSeverity] = useState('');
  const [status,   setStatus]   = useState('');
  const [area,     setArea]     = useState('');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [assignIncidentId, setAssignIncidentId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDept, setAssignDept] = useState('');

  const [showBulkAssign, setShowBulkAssign] = useState(false);
  const [bulkDept, setBulkDept] = useState('');

  const [detailIncident, setDetailIncident] = useState<IncidentType | null>(null);

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

  async function handleMarkInProgress(id: string) {
    try {
      await gqlUpdateIncidentStatus(id, 'in_progress');
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: 'in_progress' as const } : i));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleClose(id: string) {
    try {
      await gqlUpdateIncidentStatus(id, 'closed');
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, status: 'closed' as const } : i));
    } catch (e: any) {
      setError(e.message);
    }
  }

  function handleAssignClick(id: string) {
    setAssignIncidentId(id);
    setAssignUserId('');
    setAssignDept('');
  }

  async function handleConfirmAssign() {
    if (!assignIncidentId || !assignUserId.trim()) return;
    try {
      await gqlAssignIncident(assignIncidentId, assignUserId.trim(), assignDept || undefined);
      setIncidents(prev => prev.map(i => i.id === assignIncidentId ? { ...i, status: 'assigned' as const } : i));
      setAssignIncidentId(null);
      setAssignUserId('');
      setAssignDept('');
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleBulkResolve() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await gqlBulkUpdateIncidentStatus(ids, 'resolved');
      setIncidents(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, status: 'resolved' as const } : i));
      setSelectedIds(new Set());
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleConfirmBulkAssign() {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await gqlBulkUpdateIncidentStatus(ids, 'assigned');
      setIncidents(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, status: 'assigned' as const } : i));
      setSelectedIds(new Set());
      setShowBulkAssign(false);
      setBulkDept('');
    } catch (e: any) {
      setError(e.message);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  }

  const filtered = incidents.filter(r => {
    if (search   && !r.type.toLowerCase().includes(search.toLowerCase()) && !(r.addressLabel?.toLowerCase().includes(search.toLowerCase()))) return false;
    if (severity && r.severity !== severity) return false;
    if (status   && r.status   !== status)   return false;
    if (area     && r.zone     !== area)     return false;
    return true;
  });

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <AdminLayout title="Reports" subtitle={`${filtered.length} reports · Redemption City`}>
      <style>{`@keyframes shimmer{0%{background-position:-200px 0}100%{background-position:calc(200px + 100%) 0}}`}</style>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', marginBottom: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, color: '#EF4444', fontSize: 13 }}>
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'rgba(239,68,68,0.2)', border: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 600, fontSize: 12, padding: '3px 10px', borderRadius: 6 }}>Dismiss</button>
        </div>
      )}

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

      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', marginBottom: 16,
          background: 'rgba(0,200,150,0.07)', border: '1px solid rgba(0,200,150,0.22)',
          borderRadius: 'var(--radius-md)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
            {selectedIds.size} selected
          </span>
          <div style={{ flex: 1 }} />
          <button className="btn btn-outline btn-sm" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleBulkResolve}>
            Resolve Selected
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => { setShowBulkAssign(true); setBulkDept(''); }}>
            Assign Selected
          </button>
        </div>
      )}

      <div className="table-wrap">
        {loading ? (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
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
              {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </th>
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
                <tr
                  key={r.id}
                  onClick={() => setDetailIncident(r)}
                  style={{ cursor: 'pointer' }}
                >
                  <td onClick={e => e.stopPropagation()} style={{ cursor: 'default' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ color: 'var(--textMuted)', fontSize: 12 }}>{r.id.slice(0, 8)}</td>
                  <td className="primary">{r.type}</td>
                  <td>
                    {r.addressLabel ?? `${r.location?.lat.toFixed(4)}, ${r.location?.lon.toFixed(4)}`}
                    <br /><span style={{ fontSize: 11, color: 'var(--textMuted)' }}>{r.zone ?? ''}</span>
                  </td>
                  <td>
                    <span className={`pill ${SEV_CLASS[r.severity]}`}>
                      <span className="pill-dot" style={{ background: 'currentColor' }} />
                      {r.severity}
                    </span>
                  </td>
                  <td><span className={`pill ${STAT_CLASS[r.status]}`}>{STAT_LABEL[r.status] ?? r.status}</span></td>
                  <td>{r.reporterName ?? 'Anonymous'}</td>
                  <td style={{ fontSize: 12 }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td onClick={e => e.stopPropagation()} style={{ cursor: 'default' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {r.status === 'submitted' && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleAssignClick(r.id)}>Assign</button>
                      )}
                      {r.status === 'assigned' && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleMarkInProgress(r.id)}>Mark In Progress</button>
                      )}
                      {(r.status === 'assigned' || r.status === 'in_progress') && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleResolve(r.id)}>Resolve</button>
                      )}
                      {r.status === 'resolved' && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleClose(r.id)}>Close</button>
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

      {assignIncidentId && (
        <div style={OVERLAY} onClick={() => setAssignIncidentId(null)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Assign Incident</div>
            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">Assignee User ID</label>
              <input
                className="input"
                placeholder="Enter user ID..."
                value={assignUserId}
                onChange={e => setAssignUserId(e.target.value)}
              />
            </div>
            <div className="input-group" style={{ marginBottom: 24 }}>
              <label className="input-label">Department (optional)</label>
              <select className="input" value={assignDept} onChange={e => setAssignDept(e.target.value)}>
                <option value="">No department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setAssignIncidentId(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleConfirmAssign} disabled={!assignUserId.trim()}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {showBulkAssign && (
        <div style={OVERLAY} onClick={() => setShowBulkAssign(false)}>
          <div style={MODAL} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Assign {selectedIds.size} Selected</div>
            <p style={{ fontSize: 13, color: 'var(--textSub)', marginBottom: 20 }}>
              This will mark the selected incidents as assigned.
            </p>
            <div className="input-group" style={{ marginBottom: 24 }}>
              <label className="input-label">Department (optional)</label>
              <select className="input" value={bulkDept} onChange={e => setBulkDept(e.target.value)}>
                <option value="">No department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setShowBulkAssign(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleConfirmBulkAssign}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {detailIncident && (
        <div style={OVERLAY} onClick={() => setDetailIncident(null)}>
          <div style={{ ...MODAL, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{detailIncident.type}</div>
                <div style={{ fontSize: 12, color: 'var(--textMuted)', marginTop: 4, fontFamily: 'monospace' }}>{detailIncident.id}</div>
              </div>
              <button
                onClick={() => setDetailIncident(null)}
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--textSub)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--textMuted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 5 }}>
                  Severity
                </div>
                <span className={`pill ${SEV_CLASS[detailIncident.severity]}`}>
                  <span className="pill-dot" style={{ background: 'currentColor' }} />
                  {detailIncident.severity}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--textMuted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 5 }}>
                  Status
                </div>
                <span className={`pill ${STAT_CLASS[detailIncident.status]}`}>{STAT_LABEL[detailIncident.status] ?? detailIncident.status}</span>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--textMuted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 5 }}>
                  Department
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{detailIncident.department || <span style={{ color: 'var(--textMuted)', fontStyle: 'italic' }}>Not assigned</span>}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--textMuted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 5 }}>
                  Assignee
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{detailIncident.assigneeName || <span style={{ color: 'var(--textMuted)', fontStyle: 'italic' }}>Unassigned</span>}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--textMuted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 5 }}>
                  Location
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>
                  {detailIncident.location
                    ? `${detailIncident.location.lat.toFixed(6)}, ${detailIncident.location.lon.toFixed(6)}`
                    : <span style={{ color: 'var(--textMuted)', fontStyle: 'italic' }}>No coordinates</span>}
                </div>
                {detailIncident.addressLabel && (
                  <div style={{ fontSize: 11, color: 'var(--textSub)', marginTop: 2 }}>{detailIncident.addressLabel}</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--textMuted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 5 }}>
                  Zone
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)' }}>{detailIncident.zone || <span style={{ color: 'var(--textMuted)', fontStyle: 'italic' }}>Unknown</span>}</div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--textMuted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
                Description
              </div>
              <div style={{ fontSize: 13, color: 'var(--textSub)', lineHeight: 1.7, background: 'var(--surface2)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--border)' }}>
                {detailIncident.description || <span style={{ color: 'var(--textMuted)', fontStyle: 'italic' }}>No description provided.</span>}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--textMuted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
                Timeline
              </div>
              <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                {[
                  { label: 'Created', value: detailIncident.createdAt },
                  { label: 'Updated', value: detailIncident.updatedAt },
                  { label: 'Resolved', value: detailIncident.resolvedAt },
                ].filter(t => t.value).map((t, i) => (
                  <div key={t.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px',
                    borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--textSub)' }}>{t.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{new Date(t.value!).toLocaleString()}</span>
                  </div>
                ))}
                {!detailIncident.createdAt && !detailIncident.updatedAt && !detailIncident.resolvedAt && (
                  <div style={{ padding: 14, textAlign: 'center', fontSize: 12, color: 'var(--textMuted)', fontStyle: 'italic' }}>No timeline data</div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--textMuted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>
                Comments
              </div>
              <div style={{ fontSize: 13, color: 'var(--textMuted)', fontStyle: 'italic', textAlign: 'center', padding: 20, background: 'var(--surface2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                Comments are not available in this view.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => setDetailIncident(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
