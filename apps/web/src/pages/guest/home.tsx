import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import GuestLayout from './layout';
import { getIncidentsNearby } from '../../services/incidents';
import CampMap, { MapMarker, MapLine } from '../../components/map/CampMap';
import { REDEMPTION_CITY_CENTER } from '@camppulse/map-config';

const SEV: Record<string, { color: string; label: string }> = {
  critical: { color: '#EF4444', label: 'Critical' },
  high:     { color: '#F97316', label: 'High'     },
  medium:   { color: '#EAB308', label: 'Medium'   },
  low:      { color: '#22C55E', label: 'Low'      },
};

interface Destination { id: string; name: string; area: string; lat: number; lng: number; }

const DESTINATIONS: Destination[] = [
  { id: 'd1',  name: 'Main Auditorium',    area: 'Central Camp',     lat: 6.9271, lng: 3.3958 },
  { id: 'd2',  name: 'Festival Arena',     area: 'East Wing',        lat: 6.9284, lng: 3.3974 },
  { id: 'd3',  name: 'North Gate',         area: 'Camp Entrance',    lat: 6.9304, lng: 3.3954 },
  { id: 'd4',  name: 'Medical Centre',     area: 'South Block',      lat: 6.9254, lng: 3.3944 },
  { id: 'd5',  name: 'Canaan Land Estate', area: 'Residential Zone', lat: 6.9234, lng: 3.3934 },
  { id: 'd6',  name: 'Camp Bus Terminal',  area: 'West Gate',        lat: 6.9294, lng: 3.3994 },
  { id: 'd7',  name: 'Dining Hall',        area: 'Central Camp',     lat: 6.9264, lng: 3.3964 },
  { id: 'd8',  name: 'Camp Bookshop',      area: 'Admin Block',      lat: 6.9274, lng: 3.3954 },
  { id: 'd9',  name: 'VIP Guest House',    area: 'North Wing',       lat: 6.9289, lng: 3.3949 },
  { id: 'd10', name: 'Prayer Mountain',    area: 'Mountain Zone',    lat: 6.9214, lng: 3.3924 },
];

export default function GuestHome() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [destination,  setDestination]  = useState<Destination | null>(null);
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [routeLine,    setRouteLine]    = useState<MapLine | null>(null);

  useEffect(() => {
    getIncidentsNearby(REDEMPTION_CITY_CENTER.lat, REDEMPTION_CITY_CENTER.lon, 2000)
      .then(data => {
        setIncidents(data.data.map(inc => ({
          id: inc.id,
          lat: inc.location.lat,
          lng: inc.location.lon,
          type: inc.severity,
          label: inc.type,
          area: inc.address_label ?? 'Unknown',
          time: 'reported',
        })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = [
      { id: 'user', lat: REDEMPTION_CITY_CENTER.lat, lng: REDEMPTION_CITY_CENTER.lon, color: '#0EA5E9', size: 16 },
      ...incidents.map(inc => ({
        id: inc.id,
        lat: inc.lat,
        lng: inc.lng,
        color: SEV[inc.type].color,
        label: inc.label,
        size: 14
      }))
    ];
    if (destination) {
      list.push({ id: 'dest', lat: destination.lat, lng: destination.lng, color: '#00C896', size: 20 });
    }
    return list;
  }, [incidents, destination]);

  function navigateTo(dest: Destination) {
    setDestination(dest);
    setSearchQuery('');
    setSearchFocused(false);
    setRouteLine({
      id: 'route',
      coordinates: [
        { lat: REDEMPTION_CITY_CENTER.lat, lng: REDEMPTION_CITY_CENTER.lon },
        { lat: dest.lat, lng: dest.lng }
      ],
      color: '#00C896',
      width: 4,
      dash: [3, 2]
    });
  }

  function clearDestination() {
    setDestination(null);
    setRouteLine(null);
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
        <CampMap
          markers={markers}
          lines={routeLine ? [routeLine] : []}
          height="100%"
        />

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
          <span>{loading ? 'Loading...' : `${incidents.length} Active Incidents`}</span>
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
            {incidents.map(inc => (
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

