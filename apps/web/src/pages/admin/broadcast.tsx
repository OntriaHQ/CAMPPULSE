import { useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { gqlSendZoneBroadcast } from '../../services/admin';

const AREAS = [
  { id: 'auditorium',    label: 'Auditorium Area',  count: 12 },
  { id: 'north-gate',    label: 'North Gate',        count: 5  },
  { id: 'festival',      label: 'Festival Arena',    count: 8  },
  { id: 'canaan-land',   label: 'Canaan Land',       count: 2  },
  { id: 'south-camp',    label: 'South Camp',        count: 4  },
  { id: 'camp-road',     label: 'Camp Road',         count: 6  },
  { id: 'all',           label: 'All Areas',         count: 0  },
];

interface HistoryItem {
  id: string;
  areas: string;
  priority: string;
  msg: string;
  by: string;
  ago: string;
  created_at: string;
}

const PRIORITY_CLASS: Record<string, string> = { critical: 'pill-critical', high: 'pill-high', medium: 'pill-medium', low: 'pill-low' };
const STORAGE_KEY = 'cp_broadcast_history';

function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 20)));
}

export default function AdminBroadcastPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [priority, setPriority] = useState('medium');
  const [message,  setMessage]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [apiError, setApiError] = useState('');
  const [history,  setHistory]  = useState<HistoryItem[]>(loadHistory);

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
    setApiError('');

    try {
      const zone = selected.includes('all') ? 'all' : selected.map(id => AREAS.find(a => a.id === id)?.label ?? id).join(',');
      const title = `[${priority.toUpperCase()}] Announcement`;
      const result = await gqlSendZoneBroadcast(zone, title, message);

      const item: HistoryItem = {
        id: result.id ?? Date.now().toString(),
        areas: zone,
        priority,
        msg: message,
        by: 'Camp Management',
        ago: 'Just now',
        created_at: new Date().toISOString(),
      };
      const updated = [item, ...history];
      setHistory(updated);
      saveHistory(updated);
      setSent(true);
      setMessage('');
      setSelected([]);
      setTimeout(() => setSent(false), 3000);
    } catch (e: any) {
      setApiError(e.message);
    } finally {
      setSending(false);
    }
  }

  const selectedLabels = AREAS.filter(a => selected.includes(a.id)).map(a => a.label).join(', ');

  return (
    <AdminLayout title="Announcements" subtitle="Send messages to residents and visitors">
      {apiError && <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, color: '#EF4444', fontSize: 13 }}>{apiError}</div>}

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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

        <div className="card" style={{ height: 'fit-content' }}>
          <div className="card-title">Recent Announcements</div>
          {history.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--textMuted)', fontSize: 13 }}>No announcements yet</div>
          ) : (
            history.map(h => (
              <div key={h.id} className="broadcast-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="broadcast-zones">{h.areas}</span>
                  <span className={`pill ${PRIORITY_CLASS[h.priority]}`} style={{ fontSize: 10 }}>{h.priority}</span>
                </div>
                <div className="broadcast-msg">{h.msg}</div>
                <div className="broadcast-meta">{h.by} · {h.ago}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
