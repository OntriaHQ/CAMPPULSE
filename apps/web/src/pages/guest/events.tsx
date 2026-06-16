import { useState } from 'react';
import GuestLayout from './layout';

type Category = 'all' | 'service' | 'conference' | 'youth' | 'special';

const EVENTS = [
  {
    id: '1', title: 'Holy Ghost Service',
    subtitle: 'Monthly all-night service with Pastor E.A. Adeboye',
    date: 'Fri, 27 Jun 2025', time: '7:00 PM — All night',
    area: 'Main Auditorium', category: 'service' as Category,
    status: 'upcoming', attendance: '500,000+', featured: true,
  },
  {
    id: '2', title: 'Workers In Training (WIT)',
    subtitle: 'Monthly training for RCCG workers and ministers',
    date: 'Sat, 21 Jun 2025', time: '9:00 AM — 4:00 PM',
    area: 'Festival Arena', category: 'conference' as Category,
    status: 'upcoming', attendance: '50,000+',
  },
  {
    id: '3', title: 'Youth Sunday',
    subtitle: 'Redemption City youth fellowship and praise session',
    date: 'Sun, 22 Jun 2025', time: '8:00 AM — 12:00 PM',
    area: 'Auditorium Annex', category: 'youth' as Category,
    status: 'upcoming', attendance: '20,000+',
  },
  {
    id: '4', title: 'Pastors & Workers Convention',
    subtitle: 'Annual ministers gathering and leadership summit',
    date: 'Mon 7 — Fri 11 Jul 2025', time: 'All day',
    area: 'Main Auditorium · Festival Arena', category: 'conference' as Category,
    status: 'upcoming', attendance: '1,000,000+',
  },
  {
    id: '5', title: 'Special Thanksgiving Service',
    subtitle: 'Praise and thanksgiving to God for the new year of blessings',
    date: 'Sun, 15 Jun 2025', time: '8:00 AM — 1:00 PM',
    area: 'Main Auditorium', category: 'special' as Category,
    status: 'past', attendance: '200,000+',
  },
  {
    id: '6', title: 'RCCG Youth Congress',
    subtitle: 'Annual congress for the youth arm of the RCCG',
    date: 'Fri 1 — Sun 3 Aug 2025', time: 'Multi-day',
    area: 'Festival Arena', category: 'youth' as Category,
    status: 'upcoming', attendance: '300,000+',
  },
];

const CATS: { key: Category; label: string }[] = [
  { key: 'all',        label: 'All'         },
  { key: 'service',    label: 'Services'    },
  { key: 'conference', label: 'Conferences' },
  { key: 'youth',      label: 'Youth'       },
  { key: 'special',    label: 'Special'     },
];

const STATUS_COLOR: Record<string, string> = {
  upcoming: 'var(--accent)',
  ongoing:  'var(--high)',
  past:     'var(--textMuted)',
};

export default function GuestEventsPage() {
  const [cat, setCat] = useState<Category>('all');

  const featured = EVENTS.find(e => e.featured);
  const rest = EVENTS.filter(e => {
    if (e.featured) return false;
    if (cat !== 'all' && e.category !== cat) return false;
    return true;
  });

  return (
    <GuestLayout>
      <div className="g-page">
        <div className="g-page-inner">

          <div className="g-events-header">
            <div>
              <h1 className="g-page-title">Events</h1>
              <p className="g-page-sub">Redemption City · RCCG</p>
            </div>
          </div>

          {/* Featured card */}
          {featured && (
            <div className="g-featured-card">
              <div className="g-featured-glow" />
              <div className="g-featured-top">
                <span className="g-featured-badge">Featured</span>
                <span className="pill pill-low" style={{ color: STATUS_COLOR[featured.status], background: STATUS_COLOR[featured.status] + '1A', borderColor: STATUS_COLOR[featured.status] + '55' }}>
                  <span className="pill-dot" style={{ background: STATUS_COLOR[featured.status] }} />
                  {featured.status.charAt(0).toUpperCase() + featured.status.slice(1)}
                </span>
              </div>
              <h2 className="g-featured-title">{featured.title}</h2>
              <p className="g-featured-sub">{featured.subtitle}</p>
              <div className="g-featured-meta">
                <span className="g-meta-chip">◷ {featured.date}</span>
                <span className="g-meta-chip">◈ {featured.time}</span>
                <span className="g-meta-chip">◎ {featured.area}</span>
                <span className="g-meta-chip">◉ {featured.attendance} expected</span>
              </div>
            </div>
          )}

          {/* Category filters */}
          <div className="g-cat-row">
            {CATS.map(c => (
              <button
                key={c.key}
                className={`g-cat-pill${cat === c.key ? ' active' : ''}`}
                onClick={() => setCat(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Event grid */}
          <div className="g-event-grid">
            {rest.map(ev => (
              <div key={ev.id} className="g-event-card">
                <div className="g-event-stripe" style={{ background: STATUS_COLOR[ev.status] }} />
                <div className="g-event-body">
                  <div className="g-event-top">
                    <div style={{ flex: 1 }}>
                      <p className="g-event-title">{ev.title}</p>
                      <p className="g-event-sub">{ev.subtitle}</p>
                    </div>
                    <span
                      className="pill"
                      style={{
                        color: STATUS_COLOR[ev.status],
                        background: STATUS_COLOR[ev.status] + '1A',
                        borderColor: STATUS_COLOR[ev.status] + '55',
                        fontSize: 10,
                        flexShrink: 0,
                      }}
                    >
                      <span className="pill-dot" style={{ background: STATUS_COLOR[ev.status] }} />
                      {ev.status.charAt(0).toUpperCase() + ev.status.slice(1)}
                    </span>
                  </div>
                  <div className="g-event-meta">
                    <span>{ev.date}</span>
                    <span style={{ color: 'var(--textMuted)' }}>·</span>
                    <span>{ev.area}</span>
                  </div>
                  <div className="g-event-footer">
                    <span style={{ color: 'var(--textMuted)', fontSize: 12 }}>{ev.time}</span>
                    <span className="g-attendance">{ev.attendance} expected</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </GuestLayout>
  );
}
