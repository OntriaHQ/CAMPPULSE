import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import GuestLayout from './layout';

const CAMP_LAT = 6.7617;
const CAMP_LNG = 3.6664;

const INCIDENTS = [
  { id: '1', lat: 6.7635, lng: 3.6650, type: 'critical', label: 'Flooding',         area: 'Camp Road',      time: '2h ago'    },
  { id: '2', lat: 6.7650, lng: 3.6680, type: 'high',     label: 'Crowd Congestion', area: 'North Gate',     time: '5h ago'    },
  { id: '3', lat: 6.7600, lng: 3.6700, type: 'medium',   label: 'Streetlight Out',  area: 'Festival Arena', time: 'Yesterday' },
  { id: '4', lat: 6.7580, lng: 3.6640, type: 'low',      label: 'Water Supply',     area: 'Canaan Land',    time: '3d ago'    },
];

const SEV: Record<string, { color: string; label: string }> = {
  critical: { color: '#EF4444', label: 'Critical' },
  high:     { color: '#F97316', label: 'High'     },
  medium:   { color: '#EAB308', label: 'Medium'   },
  low:      { color: '#22C55E', label: 'Low'      },
};

interface Destination { id: string; name: string; area: string; lat: number; lng: number; }

const DESTINATIONS: Destination[] = [
  { id: 'd1',  name: 'Main Auditorium',    area: 'Central Camp',     lat: 6.7617, lng: 3.6664 },
  { id: 'd2',  name: 'Festival Arena',     area: 'East Wing',        lat: 6.7630, lng: 3.6680 },
  { id: 'd3',  name: 'North Gate',         area: 'Camp Entrance',    lat: 6.7650, lng: 3.6660 },
  { id: 'd4',  name: 'Medical Centre',     area: 'South Block',      lat: 6.7600, lng: 3.6650 },
  { id: 'd5',  name: 'Canaan Land Estate', area: 'Residential Zone', lat: 6.7580, lng: 3.6640 },
  { id: 'd6',  name: 'Camp Bus Terminal',  area: 'West Gate',        lat: 6.7640, lng: 3.6700 },
  { id: 'd7',  name: 'Dining Hall',        area: 'Central Camp',     lat: 6.7610, lng: 3.6670 },
  { id: 'd8',  name: 'Camp Bookshop',      area: 'Admin Block',      lat: 6.7620, lng: 3.6660 },
  { id: 'd9',  name: 'VIP Guest House',    area: 'North Wing',       lat: 6.7635, lng: 3.6655 },
  { id: 'd10', name: 'Prayer Mountain',    area: 'Mountain Zone',    lat: 6.7560, lng: 3.6630 },
];

export default function GuestHome() {
  const mapRef    = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const routeLineRef  = useRef<any>(null);

  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [destination,  setDestination]  = useState<Destination | null>(null);
  const [panelOpen,    setPanelOpen]    = useState(false);

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id   = 'leaflet-css';
      link.rel  = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    function initMap() {
      const L = (window as any).L;
      if (!L || !mapRef.current || leafletRef.current) return;

      const map = L.map(mapRef.current, {
        center: [CAMP_LAT, CAMP_LNG],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20, subdomains: 'abcd',
      }).addTo(map);

      INCIDENTS.forEach(inc => {
        const el = document.createElement('div');
        el.style.cssText = `width:22px;height:22px;border-radius:50%;background:${SEV[inc.type].color};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35),0 0 0 4px ${SEV[inc.type].color}33`;
        const icon = L.divIcon({ html: el.outerHTML, className: '', iconSize: [22, 22], iconAnchor: [11, 11] });
        L.marker([inc.lat, inc.lng], { icon }).bindPopup(`<b>${inc.label}</b><br>${inc.area}`).addTo(map);
      });

      const userEl = document.createElement('div');
      userEl.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#0EA5E9;border:3px solid #fff;box-shadow:0 2px 8px rgba(14,165,233,0.55),0 0 0 6px rgba(14,165,233,0.18)';
      const userIcon = L.divIcon({ html: userEl.outerHTML, className: '', iconSize: [16, 16], iconAnchor: [8, 8] });
      L.marker([CAMP_LAT, CAMP_LNG], { icon: userIcon }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      leafletRef.current = map;
    }

    if ((window as any).L) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.head.appendChild(script);
    }

    return () => {
      if (leafletRef.current) { leafletRef.current.remove(); leafletRef.current = null; }
    };
  }, []);

  function navigateTo(dest: Destination) {
    setDestination(dest);
    setSearchQuery('');
    setSearchFocused(false);
    const L = (window as any).L;
    const map = leafletRef.current;
    if (!L || !map) return;

    if (destMarkerRef.current) { map.removeLayer(destMarkerRef.current); }
    if (routeLineRef.current)  { map.removeLayer(routeLineRef.current);  }

    const dEl = document.createElement('div');
    dEl.style.cssText = 'width:28px;height:28px;border-radius:50%;background:#00C896;border:3px solid #fff;box-shadow:0 2px 12px rgba(0,200,150,0.6),0 0 0 6px rgba(0,200,150,0.20)';
    const dIcon = L.divIcon({ html: dEl.outerHTML, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
    destMarkerRef.current = L.marker([dest.lat, dest.lng], { icon: dIcon })
      .bindPopup(`<b>${dest.name}</b><br>${dest.area}`)
      .addTo(map);
    routeLineRef.current = L.polyline([[CAMP_LAT, CAMP_LNG], [dest.lat, dest.lng]], {
      color: '#00C896', weight: 4, dashArray: '10,7', opacity: 0.85,
    }).addTo(map);
    map.fitBounds([[CAMP_LAT, CAMP_LNG], [dest.lat, dest.lng]], { padding: [80, 80] });
  }

  function clearDestination() {
    setDestination(null);
    const map = leafletRef.current;
    if (!map) return;
    if (destMarkerRef.current) { map.removeLayer(destMarkerRef.current); destMarkerRef.current = null; }
    if (routeLineRef.current)  { map.removeLayer(routeLineRef.current);  routeLineRef.current  = null; }
    map.setView([CAMP_LAT, CAMP_LNG], 15);
  }

  const filtered = DESTINATIONS.filter(d =>
    searchQuery.trim() === '' ||
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.area.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showDropdown = searchFocused && (searchQuery.length > 0 || true);

  return (
    <GuestLayout>
      <div style={{ position: 'relative', height: '100%' }}>

        {/* Full-screen map */}
        <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />

        {/* Search bar */}
        <div className="g-search-wrap">
          <div className={`g-search-box${searchFocused ? ' focused' : ''}`}>
            <span className="g-search-icon">⊙</span>
            <input
              className="g-search-input"
              placeholder="Where to in Redemption Camp?"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            />
            {searchQuery && (
              <button className="g-search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>

          {showDropdown && searchFocused && (
            <div className="g-search-dropdown">
              {filtered.map(dest => (
                <button key={dest.id} className="g-search-result" onMouseDown={() => navigateTo(dest)}>
                  <span className="g-result-icon">◎</span>
                  <span className="g-result-body">
                    <span className="g-result-name">{dest.name}</span>
                    <span className="g-result-area">{dest.area}</span>
                  </span>
                  <span className="g-result-arrow">›</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation banner */}
        {destination && (
          <div className="g-nav-banner">
            <div className="g-nav-banner-stripe" />
            <span className="g-nav-icon">↗</span>
            <div className="g-nav-banner-text">
              <span className="g-nav-label">Navigating to</span>
              <span className="g-nav-dest">{destination.name}</span>
            </div>
            <button className="g-nav-clear" onClick={clearDestination}>✕</button>
          </div>
        )}

        {/* Alert chip */}
        <div className="g-alert-chip">
          <span className="g-alert-dot" />
          <span>{INCIDENTS.length} Active Incidents</span>
        </div>

        {/* Incident panel toggle */}
        <button className="g-panel-toggle" onClick={() => setPanelOpen(v => !v)}>
          {panelOpen ? '›' : '‹'} {!panelOpen && 'Activity'}
        </button>

        {/* Incident side panel */}
        <div className={`g-panel${panelOpen ? ' open' : ''}`}>
          <div className="g-panel-head">
            <span className="g-panel-title">Nearby Activity</span>
            <button className="g-panel-close" onClick={() => setPanelOpen(false)}>✕</button>
          </div>
          <div className="g-panel-list">
            {INCIDENTS.map(inc => (
              <div key={inc.id} className="g-incident-card">
                <div className="g-incident-stripe" style={{ background: SEV[inc.type].color }} />
                <div className="g-incident-body">
                  <div className="g-incident-row">
                    <span className="g-incident-label">{inc.label}</span>
                    <span className="g-incident-time">{inc.time}</span>
                  </div>
                  <div className="g-incident-sub">
                    <span className="g-incident-dot" style={{ background: SEV[inc.type].color }} />
                    <span className="g-incident-area">{inc.area}</span>
                    <span className="g-incident-sev" style={{ color: SEV[inc.type].color }}>{SEV[inc.type].label}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link to="/report" className="g-panel-report-btn">Report an Incident</Link>
        </div>

        {/* Report FAB */}
        <Link to="/report" className="g-fab">
          + Report
        </Link>
      </div>
    </GuestLayout>
  );
}
