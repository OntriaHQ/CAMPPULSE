import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { fetchLiveDrivers } from '../../services/drivers';
import type { LiveDriver } from '../../services/drivers';

const STATUS_CLASS: Record<string, string> = { active: 'pill-resolved', en_route: 'pill-active', idle: 'pill-muted' };
const STATUS_LABEL: Record<string, string> = { active: 'Active', en_route: 'En Route', idle: 'Available' };

export default function AdminResponseTeamsPage() {
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetchLiveDrivers()
      .then(setDrivers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = drivers.length;

  return (
    <AdminLayout title="Response Teams" subtitle={`${activeCount} active · Redemption City`}>
      {error && <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, color: '#EF4444', fontSize: 13 }}>{error}</div>}

      <div className="stats-grid mb-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Active Now</div>
          <div className="stat-value">{drivers.length}</div>
          <div className="stat-delta">Live from Redis</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Unique Zones</div>
          <div className="stat-value" style={{ color: 'var(--low)' }}>{new Set(drivers.map(d => d.zone)).size}</div>
          <div className="stat-delta up">Covered areas</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last Updated</div>
          <div className="stat-value" style={{ fontSize: 16, color: 'var(--accentEnd)' }}>30s TTL</div>
          <div className="stat-delta">Redis location cache</div>
        </div>
      </div>

      <div className="table-wrap">
        {loading ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>Loading live drivers...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Location</th>
                <th>Zone</th>
                <th>Status</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>
                    No drivers currently active
                  </td>
                </tr>
              ) : (
                drivers.map(d => (
                  <tr key={d.user_id}>
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
                    <td>{d.zone}</td>
                    <td><span className="pill pill-resolved">Active</span></td>
                    <td style={{ fontSize: 12 }}>{new Date(d.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
