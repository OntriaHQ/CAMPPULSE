import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { fetchEvents, createEvent, deleteEvent } from '../../services/events';
import type { CampEvent } from '../../services/events';

type Category = 'all' | 'service' | 'conference' | 'youth' | 'special';
type Status = 'all' | 'upcoming' | 'ongoing' | 'past' | 'cancelled';

const CATEGORY_LABELS: Record<string, string> = {
  service: 'Service',
  conference: 'Conference',
  youth: 'Youth',
  special: 'Special',
};

const STATUS_CLASS: Record<string, string> = {
  upcoming: 'pill pill-active',
  ongoing: 'pill pill-high',
  past: 'pill pill-muted',
  cancelled: 'pill pill-muted',
};

export default function AdminEventsPage() {
  const [events, setEvents] = useState<CampEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [status, setStatus] = useState<Status>('all');
  const [search, setSearch] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '', description: '', date: '', time: '',
    area: '', category: 'service' as string, attendance: '',
  });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    fetchEvents(
      category !== 'all' ? category : undefined,
      status !== 'all' ? status : undefined,
      search || undefined,
    )
      .then(res => { setEvents(res.items); setTotal(res.total); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [category, status]);

  function handleSearch() {
    load();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.time || !formData.area) return;
    setSaving(true);
    try {
      await createEvent({
        ...formData,
        description: formData.description || '',
        attendance: formData.attendance || undefined,
      });
      setShowForm(false);
      setFormData({ title: '', description: '', date: '', time: '', area: '', category: 'service', attendance: '' });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this event?')) return;
    try {
      await deleteEvent(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const upcoming = events.filter(e => e.status === 'upcoming').length;
  const ongoing = events.filter(e => e.status === 'ongoing').length;
  const nextEvent = events.find(e => e.status === 'upcoming' || e.status === 'ongoing');

  return (
    <AdminLayout title="Events" subtitle="Upcoming programmes and services at Redemption City">
      {error && <div style={{ padding: 12, marginBottom: 16, background: 'rgba(239,68,68,0.12)', borderRadius: 10, color: '#EF4444', fontSize: 13 }}>{error}</div>}

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Events</div>
          <div className="stat-value">{total}</div>
          <div className="stat-delta">On record</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Upcoming</div>
          <div className="stat-value">{upcoming}</div>
          <div className="stat-delta up">Scheduled</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ongoing</div>
          <div className="stat-value">{ongoing}</div>
          <div className="stat-delta">{ongoing ? 'Active now' : 'None active'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Next Event</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{nextEvent?.title ?? '—'}</div>
          <div className="stat-delta up">{nextEvent?.date ?? ''}</div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div className="search-input-wrap">
          <span className="search-icon">&#9906;</span>
          <input
            className="input"
            placeholder="Search by name or area..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          />
        </div>
        <select className="filter-select" value={category} onChange={e => setCategory(e.target.value as Category)}>
          <option value="all">All Categories</option>
          <option value="service">Services</option>
          <option value="conference">Conferences</option>
          <option value="youth">Youth</option>
          <option value="special">Special</option>
        </select>
        <select className="filter-select" value={status} onChange={e => setStatus(e.target.value as Status)}>
          <option value="all">All Status</option>
          <option value="upcoming">Upcoming</option>
          <option value="ongoing">Ongoing</option>
          <option value="past">Past</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Event'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Create New Event</div>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Title *</label>
                <input className="input" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label className="input-label">Area *</label>
                <input className="input" value={formData.area} onChange={e => setFormData(f => ({ ...f, area: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label className="input-label">Date *</label>
                <input className="input" value={formData.date} onChange={e => setFormData(f => ({ ...f, date: e.target.value }))} placeholder="e.g. Fri, 27 Jun 2025" required />
              </div>
              <div className="input-group">
                <label className="input-label">Time *</label>
                <input className="input" value={formData.time} onChange={e => setFormData(f => ({ ...f, time: e.target.value }))} placeholder="e.g. 7:00 PM — All night" required />
              </div>
              <div className="input-group">
                <label className="input-label">Category</label>
                <select className="input" value={formData.category} onChange={e => setFormData(f => ({ ...f, category: e.target.value }))}>
                  <option value="service">Service</option>
                  <option value="conference">Conference</option>
                  <option value="youth">Youth</option>
                  <option value="special">Special</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Expected Attendance</label>
                <input className="input" value={formData.attendance} onChange={e => setFormData(f => ({ ...f, attendance: e.target.value }))} placeholder="e.g. 500,000+" />
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Description</label>
              <textarea className="input" rows={3} value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--textMuted)', fontSize: 14 }}>Loading events...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {events.map(event => (
            <div key={event.id} className="stat-card" style={{ gap: 12, cursor: 'default', position: 'relative' }}>
              <button
                onClick={() => handleDelete(event.id)}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'none', border: 'none', color: 'var(--textMuted)',
                  cursor: 'pointer', fontSize: 16, fontFamily: 'inherit',
                  padding: '2px 6px', borderRadius: 4,
                }}
                title="Delete event"
              >&times;</button>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{event.title}</div>
                  <span className="pill" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px', background: 'rgba(255,255,255,0.06)', color: 'var(--textMuted)' }}>
                    {CATEGORY_LABELS[event.category] ?? event.category}
                  </span>
                </div>
                <span className={STATUS_CLASS[event.status] || 'pill pill-muted'} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {event.status}
                </span>
              </div>

              <p style={{ fontSize: 13, color: 'var(--textMuted)', lineHeight: 1.55, margin: 0 }}>
                {event.description}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <EventRow label="Date" value={event.date} />
                <EventRow label="Time" value={event.time} />
                <EventRow label="Area" value={event.area} />
                {event.attendance && <EventRow label="Expected" value={event.attendance} accent />}
              </div>
            </div>
          ))}

          {!loading && events.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: '48px 0', textAlign: 'center', color: 'var(--textMuted)', fontSize: 14 }}>
              No events found. Create one to get started.
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}

function EventRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--textMuted)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: accent ? 'var(--accent)' : 'var(--textSub)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}
