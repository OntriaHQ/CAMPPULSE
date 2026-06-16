import { useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';

const AREAS = [
  { id: 'auditorium',    label: 'Auditorium Area',  count: 12 },
  { id: 'north-gate',    label: 'North Gate',        count: 5  },
  { id: 'festival',      label: 'Festival Arena',    count: 8  },
  { id: 'canaan-land',   label: 'Canaan Land',       count: 2  },
  { id: 'south-camp',    label: 'South Camp',        count: 4  },
  { id: 'camp-road',     label: 'Camp Road',         count: 6  },
  { id: 'all',           label: 'All Areas',         count: 0  },
];

const HISTORY = [
  {
    areas: 'North Gate · Camp Road',
    priority: 'high',
    msg: 'Heavy congestion at the main gate. Please use the South entrance as an alternative. Camp buses are available at the Festival Arena.',
    by: 'Camp Management', ago: '2h ago',
  },
  {
    areas: 'All Areas',
    priority: 'medium',
    msg: 'Water supply has been restored across Canaan Land Estate. Thank you for your patience.',
    by: 'Infrastructure Team', ago: '5h ago',
  },
  {
    areas: 'Festival Arena',
    priority: 'low',
    msg: 'Pathway lighting along the east section of the Festival Arena will be restored by 8pm. Please carry a torch if moving through that area.',
    by: 'Camp Management', ago: 'Yesterday',
  },
];

const PRIORITY_CLASS: Record<string, string> = { critical: 'pill-critical', high: 'pill-high', medium: 'pill-medium', low: 'pill-low' };

export default function AdminBroadcastPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [priority, setPriority] = useState('medium');
  const [message,  setMessage]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);

  function toggle(id: string) {
    if (id === 'all') {
      setSelected(prev => prev.includes('all') ? [] : ['all']);
      return;
    }
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev.filter(x => x !== 'all'), id]
    );
  }

  async function handleSend() {
    if (!selected.length || !message.trim()) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 1200));
    setSending(false);
    setSent(true);
    setMessage('');
    setSelected([]);
    setTimeout(() => setSent(false), 3000);
  }

  const selectedLabels = AREAS.filter(a => selected.includes(a.id)).map(a => a.label).join(', ');

  return (
    <AdminLayout title="Announcements" subtitle="Send messages to residents and visitors">
      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Area selector */}
          <div className="card">
            <div className="card-title">Target Area</div>
            <div className="zone-checkboxes">
              {AREAS.map(a => (
                <label key={a.id} className={`zone-checkbox-item${selected.includes(a.id) ? ' selected' : ''}`}>
                  <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                  <span className="zone-checkbox-label">{a.label}</span>
                  {a.count > 0 && <span className="zone-checkbox-count">{a.count} open issues</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="card">
            <div className="card-title">Priority</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['critical', '#EF4444'], ['high', '#F97316'], ['medium', '#EAB308'], ['low', '#22C55E']].map(([key, color]) => (
                <button key={key} onClick={() => setPriority(key)} style={{
                  flex: 1, padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: priority === key ? `${color}22` : 'var(--surface2)',
                  border: `1px solid ${priority === key ? `${color}55` : 'var(--border)'}`,
                  color: priority === key ? color : 'var(--textMuted)',
                  textTransform: 'capitalize', transition: 'all 0.15s',
                }}>
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="card">
            <div className="card-title">Message</div>
            <div className="input-group">
              <textarea
                className="input"
                placeholder="Write your announcement here..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
              />
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>
                {selected.length ? `To: ${selectedLabels}` : 'No area selected'}
              </span>
              <button className="btn btn-primary" onClick={handleSend} disabled={!selected.length || !message.trim() || sending}>
                {sending ? 'Sending...' : sent ? 'Sent!' : 'Send Announcement'}
              </button>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-title">Recent Announcements</div>
          {HISTORY.map((h, i) => (
            <div key={i} className="broadcast-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="broadcast-zones">{h.areas}</span>
                <span className={`pill ${PRIORITY_CLASS[h.priority]}`} style={{ fontSize: 10 }}>{h.priority}</span>
              </div>
              <div className="broadcast-msg">{h.msg}</div>
              <div className="broadcast-meta">{h.by} · {h.ago}</div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
