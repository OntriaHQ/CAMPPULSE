import { AdminLayout } from '../../components/layout/AdminLayout';

const MAP_DOTS = [
  { x: '48%', y: '42%', color: '#EF4444', title: 'Flooding – Camp Road near Medical'     },
  { x: '50%', y: '10%', color: '#F97316', title: 'Congestion – North Gate Entrance'      },
  { x: '75%', y: '55%', color: '#EAB308', title: 'Streetlight Out – Festival Arena East' },
  { x: '20%', y: '65%', color: '#F97316', title: 'Water Supply – Canaan Land Block C'    },
  { x: '30%', y: '80%', color: '#EAB308', title: 'Road Damage – South Camp Access Rd 2'  },
  { x: '50%', y: '38%', color: '#EF4444', title: 'Power Outage – Auditorium Block D'     },
];

const SIDEBAR_REPORTS = [
  { id: 'RPT-041', type: 'Flooding',         area: 'Camp Road',      severity: 'critical' },
  { id: 'RPT-040', type: 'Crowd Congestion', area: 'North Gate',     severity: 'high'     },
  { id: 'RPT-039', type: 'Streetlight Out',  area: 'Festival Arena', severity: 'medium'   },
  { id: 'RPT-038', type: 'Water Supply',     area: 'Canaan Land',    severity: 'high'     },
  { id: 'RPT-036', type: 'Power Outage',     area: 'Auditorium',     severity: 'critical' },
];

const AREA_SUMMARY = [
  { name: 'Auditorium',     count: 12, color: '#EF4444' },
  { name: 'North Gate',     count: 5,  color: '#F97316' },
  { name: 'Festival Arena', count: 8,  color: '#EAB308' },
  { name: 'Canaan Land',    count: 2,  color: '#22C55E' },
];

const SEV_COLOR: Record<string, string> = { critical: '#EF4444', high: '#F97316', medium: '#EAB308', low: '#22C55E' };
const GRID_H = Array.from({ length: 9 }, (_, i) => `${(i + 1) * 10}%`);
const GRID_V = Array.from({ length: 7 }, (_, i) => `${(i + 1) * 12.5}%`);

export default function AdminMapPage() {
  return (
    <AdminLayout title="Camp Map" subtitle="Redemption City · live issue overlay">
      <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 156px)' }}>

        {/* Map canvas */}
        <div className="map-web" style={{ flex: 1 }}>
          {GRID_H.map(p => <div key={`h${p}`} className="map-grid-h" style={{ top: p, left: 0, right: 0, height: 1 }} />)}
          {GRID_V.map(p => <div key={`v${p}`} className="map-grid-v" style={{ left: p, top: 0, bottom: 0, width: 1 }} />)}

          {/* North Gate — top center */}
          <div className="map-zone-block" style={{ top: '4%', left: '35%', width: '30%', height: '14%', backgroundColor: 'rgba(14,165,233,0.07)', borderColor: 'rgba(14,165,233,0.22)' }}>
            <span className="map-zone-name">North Gate</span>
          </div>

          {/* Auditorium — center */}
          <div className="map-hub" style={{ top: '30%', left: '30%', width: '40%', height: '18%', fontSize: 11 }}>
            Main Auditorium
          </div>

          {/* Camp Road — left spine */}
          <div className="map-zone-block" style={{ top: '22%', left: '5%', width: '22%', height: '50%', backgroundColor: 'rgba(0,200,150,0.06)', borderColor: 'rgba(0,200,150,0.16)' }}>
            <span className="map-zone-name">Camp Road</span>
          </div>

          {/* Festival Arena — right */}
          <div className="map-zone-block" style={{ top: '22%', right: '5%', width: '26%', height: '40%', backgroundColor: 'rgba(249,115,22,0.06)', borderColor: 'rgba(249,115,22,0.18)' }}>
            <span className="map-zone-name">Festival Arena</span>
          </div>

          {/* Canaan Land — bottom left */}
          <div className="map-zone-block" style={{ bottom: '8%', left: '5%', width: '32%', height: '22%', backgroundColor: 'rgba(234,179,8,0.05)', borderColor: 'rgba(234,179,8,0.16)' }}>
            <span className="map-zone-name">Canaan Land</span>
          </div>

          {/* South Camp — bottom right */}
          <div className="map-zone-block" style={{ bottom: '8%', right: '5%', width: '30%', height: '22%', backgroundColor: 'rgba(139,92,246,0.05)', borderColor: 'rgba(139,92,246,0.14)' }}>
            <span className="map-zone-name">South Camp</span>
          </div>

          {/* Road connectors */}
          <div style={{ position: 'absolute', top: '18%', left: '27%', width: 2, height: '12%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', top: '48%', left: '27%', width: 2, height: '22%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', top: '48%', left: '70%', width: 2, height: '22%', background: 'rgba(255,255,255,0.05)' }} />

          {/* Issue dots */}
          {MAP_DOTS.map((d, i) => (
            <div key={i} className="map-incident-dot" title={d.title}
              style={{ left: d.x, top: d.y, background: d.color, width: 14, height: 14, boxShadow: `0 0 8px ${d.color}80` }} />
          ))}

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            background: 'rgba(13,13,24,0.90)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, padding: '10px 14px',
            display: 'flex', gap: 14, alignItems: 'center',
          }}>
            {[['Critical', '#EF4444'], ['High', '#F97316'], ['Medium', '#EAB308'], ['Low', '#22C55E']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-title">Open Reports</div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SIDEBAR_REPORTS.map(r => (
                <div key={r.id} style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEV_COLOR[r.severity], flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.type}</div>
                    <div style={{ fontSize: 11, color: 'var(--textMuted)', marginTop: 2 }}>{r.area}</div>
                  </div>
                  <span style={{ fontSize: 10, color: SEV_COLOR[r.severity], fontWeight: 600, textTransform: 'uppercase' }}>
                    {r.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Reports by Area</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {AREA_SUMMARY.map(a => (
                <div key={a.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, width: 96, color: 'var(--textSub)', flexShrink: 0 }}>{a.name}</span>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--surface2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: a.color, width: `${(a.count / 12) * 100}%`, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: a.color, width: 20 }}>{a.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
