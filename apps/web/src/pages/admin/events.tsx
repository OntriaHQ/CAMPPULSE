import { useState } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';

type Category = 'all' | 'service' | 'conference' | 'youth' | 'special';
type Status   = 'all' | 'upcoming' | 'ongoing' | 'past';

interface CampEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  area: string;
  category: Exclude<Category, 'all'>;
  status: Exclude<Status, 'all'>;
  attendance: string;
}

const EVENTS: CampEvent[] = [
  {
    id: '1',
    title: 'Holy Ghost Service',
    description: 'Monthly all-night service with Pastor E.A. Adeboye. Expect large congregation from all zones.',
    date: 'Fri, 27 Jun 2025',
    time: '7:00 PM — All night',
    area: 'Main Auditorium',
    category: 'service',
    status: 'upcoming',
    attendance: '500,000+',
  },
  {
    id: '2',
    title: 'Workers In Training (WIT)',
    description: 'Monthly training and capacity building for RCCG workers and ministers across all provinces.',
    date: 'Sat, 21 Jun 2025',
    time: '9:00 AM — 4:00 PM',
    area: 'Festival Arena',
    category: 'conference',
    status: 'upcoming',
    attendance: '50,000+',
  },
  {
    id: '3',
    title: 'Youth Sunday',
    description: 'Redemption City youth fellowship, praise and worship session. High foot traffic near Auditorium Annex.',
    date: 'Sun, 22 Jun 2025',
    time: '8:00 AM — 12:00 PM',
    area: 'Auditorium Annex',
    category: 'youth',
    status: 'upcoming',
    attendance: '20,000+',
  },
  {
    id: '4',
    title: 'Pastors & Workers Convention',
    description: 'Annual ministers gathering and leadership summit. Multi-venue, expect high congestion on Camp Road and North Gate.',
    date: 'Mon 7 — Fri 11 Jul 2025',
    time: 'All day',
    area: 'Main Auditorium, Festival Arena',
    category: 'conference',
    status: 'upcoming',
    attendance: '1,000,000+',
  },
  {
    id: '5',
    title: 'Special Thanksgiving Service',
    description: 'Praise and thanksgiving service for blessings received this season.',
    date: 'Sun, 15 Jun 2025',
    time: '8:00 AM — 1:00 PM',
    area: 'Main Auditorium',
    category: 'special',
    status: 'past',
    attendance: '200,000+',
  },
  {
    id: '6',
    title: 'RCCG Youth Congress',
    description: 'Annual congress for the youth arm of the RCCG. Multi-day event at Festival Arena with overflow into Camp Road.',
    date: 'Fri 1 — Sun 3 Aug 2025',
    time: 'Multi-day',
    area: 'Festival Arena',
    category: 'youth',
    status: 'upcoming',
    attendance: '300,000+',
  },
  {
    id: '7',
    title: 'Holy Ghost Congress',
    description: 'Annual five-day congress — one of the largest Christian gatherings in the world.',
    date: 'Tue 2 — Sat 6 Dec 2025',
    time: 'Multi-day',
    area: 'Main Auditorium, All Zones',
    category: 'service',
    status: 'upcoming',
    attendance: '5,000,000+',
  },
];

const CATEGORY_LABELS: Record<Exclude<Category, 'all'>, string> = {
  service:    'Service',
  conference: 'Conference',
  youth:      'Youth',
  special:    'Special',
};

const STATUS_CLASS: Record<string, string> = {
  upcoming: 'pill pill-active',
  ongoing:  'pill pill-high',
  past:     'pill pill-muted',
};

export default function AdminEventsPage() {
  const [category, setCategory] = useState<Category>('all');
  const [status,   setStatus]   = useState<Status>('all');
  const [search,   setSearch]   = useState('');

  const filtered = EVENTS.filter(e => {
    if (category !== 'all' && e.category !== category) return false;
    if (status   !== 'all' && e.status   !== status)   return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) &&
                  !e.area.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const upcoming = EVENTS.filter(e => e.status === 'upcoming').length;
  const ongoing  = EVENTS.filter(e => e.status === 'ongoing').length;

  return (
    <AdminLayout title="Events" subtitle="Upcoming programmes and services at Redemption City">
      {/* KPI row */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Events</div>
          <div className="stat-value">{EVENTS.length}</div>
          <div className="stat-delta">Jun — Dec 2025</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Upcoming</div>
          <div className="stat-value">{upcoming}</div>
          <div className="stat-delta up">Scheduled</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ongoing</div>
          <div className="stat-value">{ongoing || 0}</div>
          <div className="stat-delta">{ongoing ? 'Active now' : 'None active'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Next Event</div>
          <div className="stat-value" style={{ fontSize: 18 }}>WIT</div>
          <div className="stat-delta up">Sat, 21 Jun</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div className="search-input-wrap">
          <span className="search-icon">&#9906;</span>
          <input
            className="input"
            placeholder="Search by name or area..."
            value={search}
            onChange={e => setSearch(e.target.value)}
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
        </select>
      </div>

      {/* Events grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {filtered.map(event => (
          <div key={event.id} className="stat-card" style={{ gap: 12, cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>{event.title}</div>
                <span className="pill" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.4px', background: 'rgba(255,255,255,0.06)', color: 'var(--textMuted)' }}>
                  {CATEGORY_LABELS[event.category]}
                </span>
              </div>
              <span className={STATUS_CLASS[event.status]} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {event.status}
              </span>
            </div>

            <p style={{ fontSize: 13, color: 'var(--textMuted)', lineHeight: 1.55, margin: 0 }}>
              {event.description}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <EventRow label="Date"       value={event.date}       />
              <EventRow label="Time"       value={event.time}       />
              <EventRow label="Area"       value={event.area}       />
              <EventRow label="Expected"   value={event.attendance} accent />
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: '48px 0', textAlign: 'center', color: 'var(--textMuted)', fontSize: 14 }}>
            No events match the selected filters.
          </div>
        )}
      </div>
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
