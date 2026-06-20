import { useState, useEffect } from 'react';
import GuestLayout from './layout';
import { fetchEvents, CampEvent } from '../../services/events';

const CATS: { key: string; label: string }[] = [
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
  const [events, setEvents] = useState<CampEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>('all');

  useEffect(() => {
    fetchEvents()
      .then(res => setEvents(res.items))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const featured = events.find(e => e.status === 'upcoming' && events.indexOf(e) === 0);
  const rest = events.filter(e => {
    if (featured && e.id === featured.id) return false;
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

          {/* Loading state */}
          {loading && (
            <div style={{ textAlign: 'center', color: 'var(--textMuted)', padding: '40px 0' }}>
              Loading events…
            </div>
          )}

          {/* Featured card */}
          {!loading && featured && (
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
              <p className="g-featured-sub">{featured.description}</p>
              <div className="g-featured-meta">
                <span className="g-meta-chip">◷ {featured.date}</span>
                <span className="g-meta-chip">◈ {featured.time}</span>
                <span className="g-meta-chip">◎ {featured.area}</span>
                {featured.attendance && <span className="g-meta-chip">◉ {featured.attendance} expected</span>}
              </div>
            </div>
          )}

          {/* No events state */}
          {!loading && events.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--textMuted)', padding: '40px 0' }}>
              No upcoming events right now. Check back later.
            </div>
          )}

          {/* Category filters */}
          {!loading && events.length > 0 && (
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
          )}

          {/* Event grid */}
          {!loading && (
            <div className="g-event-grid">
              {rest.map(ev => (
                <div key={ev.id} className="g-event-card">
                  <div className="g-event-stripe" style={{ background: STATUS_COLOR[ev.status] }} />
                  <div className="g-event-body">
                    <div className="g-event-top">
                      <div style={{ flex: 1 }}>
                        <p className="g-event-title">{ev.title}</p>
                        <p className="g-event-sub">{ev.description}</p>
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
                      {ev.attendance && <span className="g-attendance">{ev.attendance} expected</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </GuestLayout>
  );
}
