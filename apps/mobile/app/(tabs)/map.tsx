import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type WebViewType from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, GradientColors, Radius } from '@/constants/theme';
import { useTheme, useColors } from '@/context/ThemeContext';
import { getIncidentsNearby } from '../../services/incidents';
import { calculateRoute } from '../../services/routes';
import { wsManager } from '../../services/websocket';
import { useLocation } from '../../hooks/useLocation';

const CAMP_LAT = 6.7617;
const CAMP_LNG = 3.6664;
const WS_GUEST_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000')
  .replace(/^http/, 'ws') + '/ws/location/guest';

const SEV_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  low:      '#22C55E',
};

interface IncidentData {
  id: string;
  lat: number;
  lng: number;
  type: string;
  label: string;
  area: string;
  time: string;
}

interface Destination {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
}

const DESTINATIONS: Destination[] = [
  { id: 'd1', name: 'Main Auditorium',     area: 'Central Camp',     lat: 6.7617, lng: 3.6664 },
  { id: 'd2', name: 'Festival Arena',      area: 'East Wing',        lat: 6.7630, lng: 3.6680 },
  { id: 'd3', name: 'North Gate',          area: 'Camp Entrance',    lat: 6.7650, lng: 3.6660 },
  { id: 'd4', name: 'Medical Centre',      area: 'South Block',      lat: 6.7600, lng: 3.6650 },
  { id: 'd5', name: 'Canaan Land Estate',  area: 'Residential Zone', lat: 6.7580, lng: 3.6640 },
  { id: 'd6', name: 'Camp Bus Terminal',   area: 'West Gate',        lat: 6.7640, lng: 3.6700 },
  { id: 'd7', name: 'Dining Hall',         area: 'Central Camp',     lat: 6.7610, lng: 3.6670 },
  { id: 'd8', name: 'Camp Bookshop',       area: 'Admin Block',      lat: 6.7620, lng: 3.6660 },
  { id: 'd9', name: 'VIP Guest House',     area: 'North Wing',       lat: 6.7635, lng: 3.6655 },
  { id: 'd10', name: 'Prayer Mountain',    area: 'Mountain Zone',    lat: 6.7560, lng: 3.6630 },
];

function buildMapHtml(
  incidents: IncidentData[],
  userLat: number,
  userLng: number,
  dest: { lat: number; lng: number } | null,
  routeCoords: { lat: number; lng: number }[],
  zAlert: { zone: string; severity: string } | null,
) {
  const routeGeoJson = routeCoords.length > 0
    ? JSON.stringify(routeCoords.map(c => [c.lng, c.lat]))
    : 'null';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0A0A0F; }
    .leaflet-control-attribution, .leaflet-control-zoom { display: none; }
    .pin { width: 22px; height: 22px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,0.85); }
    .user { width: 14px; height: 14px; border-radius: 50%; background:#0EA5E9; border:3px solid #fff; box-shadow:0 0 0 6px rgba(14,165,233,0.2); }
    .dest { width: 28px; height: 28px; border-radius: 50%; background:#00C896; border:3px solid #fff; box-shadow:0 0 0 8px rgba(0,200,150,0.25), 0 0 20px rgba(0,200,150,0.5); }
    .alert-marker { width: 40px; height: 40px; border-radius: 50%; border: 3px solid #EF4444; background: rgba(239,68,68,0.15); animation: pulse 2s infinite; }
    @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.3); opacity: 0.6; } 100% { transform: scale(1); opacity: 1; } }
  </style>
</head>
<body><div id="map"></div>
<script>
  const map = L.map('map',{center:[${userLat},${userLng}],zoom:15,zoomControl:false,attributionControl:false});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:20,subdomains:'abcd'}).addTo(map);

  const incidents = ${JSON.stringify(incidents)};
  const colors = ${JSON.stringify(SEV_COLOR)};

  incidents.forEach(inc => {
    const el = document.createElement('div');
    el.className = 'pin';
    el.style.background = colors[inc.type] || '#888';
    el.style.boxShadow = '0 0 10px ' + (colors[inc.type] || '#888');
    const icon = L.divIcon({html:el.outerHTML,className:'',iconSize:[22,22],iconAnchor:[11,11]});
    L.marker([inc.lat,inc.lng],{icon}).addTo(map);
  });

  const uEl = document.createElement('div');
  uEl.className='user';
  const uIcon = L.divIcon({html:uEl.outerHTML,className:'',iconSize:[14,14],iconAnchor:[7,7]});
  const userMarker = L.marker([${userLat},${userLng}],{icon:uIcon}).addTo(map);

  let destMarker = null;
  let routeLine = null;

  ${dest ? `
  const dEl = document.createElement('div');
  dEl.className = 'dest';
  const dIcon = L.divIcon({html:dEl.outerHTML,className:'',iconSize:[28,28],iconAnchor:[14,14]});
  destMarker = L.marker([${dest.lat}, ${dest.lng}], {icon: dIcon}).addTo(map);
  ` : ''}

  ${routeGeoJson !== 'null' ? `
  routeLine = L.polyline(${routeGeoJson}.map(c => [c[1], c[0]]), {color:'#00C896',weight:3,dashArray:'8,6',opacity:0.75}).addTo(map);
  map.fitBounds(routeLine.getBounds().pad(0.2));
  ` : ''}

  ${zAlert ? `
  const aEl = document.createElement('div');
  aEl.className = 'alert-marker';
  const aIcon = L.divIcon({html:aEl.outerHTML,className:'',iconSize:[40,40],iconAnchor:[20,20]});
  L.marker([${userLat + 0.005}, ${userLng + 0.005}], {icon: aIcon}).addTo(map)
    .bindPopup('<b>Congestion: ${zAlert.zone}</b><br/>Severity: ${zAlert.severity}');
  ` : ''}

  window.addEventListener('message', function(e) {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'navigate') {
        if (destMarker) { map.removeLayer(destMarker); }
        if (routeLine)  { map.removeLayer(routeLine);  }
        const dEl = document.createElement('div');
        dEl.className = 'dest';
        const dIcon = L.divIcon({html:dEl.outerHTML,className:'',iconSize:[28,28],iconAnchor:[14,14]});
        destMarker = L.marker([msg.lat, msg.lng], {icon: dIcon}).addTo(map);
        if (msg.polyline && msg.polyline.length > 0) {
          routeLine = L.polyline(msg.polyline, {color:'#00C896',weight:3,dashArray:'8,6',opacity:0.75}).addTo(map);
          map.fitBounds(routeLine.getBounds().pad(0.2));
        } else {
          routeLine = L.polyline([[${userLat},${userLng}],[msg.lat,msg.lng]], {color:'#00C896',weight:3,dashArray:'8,6',opacity:0.75}).addTo(map);
          map.fitBounds([[${userLat},${userLng}],[msg.lat,msg.lng]], {padding:[60,60]});
        }
      } else if (msg.type === 'clear') {
        if (destMarker) { map.removeLayer(destMarker); destMarker = null; }
        if (routeLine)  { map.removeLayer(routeLine);  routeLine = null;  }
        map.setView([${userLat},${userLng}], 15);
      } else if (msg.type === 'recenter') {
        map.setView([${userLat},${userLng}], 15);
      }
    } catch(err) {}
  });
</script>
</body></html>`;
}

const COLLAPSED = 72;
const EXPANDED  = 340;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const C = useColors();

  const webViewRef = useRef<WebViewType>(null);
  const sheetAnim  = useRef(new Animated.Value(COLLAPSED)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;

  const [sheetOpen,       setSheetOpen]       = useState(false);
  const [searchOpen,      setSearchOpen]       = useState(false);
  const [searchQuery,     setSearchQuery]      = useState('');
  const [destination,     setDestination]      = useState<Destination | null>(null);
  const [incidents,       setIncidents]       = useState<IncidentData[]>([]);
  const [routeCoords,     setRouteCoords]     = useState<{ lat: number; lng: number }[]>([]);
  const [zoneAlert,       setZoneAlert]       = useState<{ zone: string; severity: string } | null>(null);

  const { location: userLocation } = useLocation({ sendPings: false });

  const userLat = userLocation?.latitude ?? CAMP_LAT;
  const userLng = userLocation?.longitude ?? CAMP_LNG;

  // Fetch incidents from API
  const fetchIncidents = useCallback(async () => {
    try {
      const data = await getIncidentsNearby(userLat, userLng, 2000);
      setIncidents(data.map(inc => ({
        id: inc.id,
        lat: 0, lng: 0,
        type: inc.severity,
        label: inc.type,
        area: inc.address_label ?? 'Unknown',
        time: 'Nearby',
      })));
    } catch {
      // fallback: keep current incidents
    }
  }, [userLat, userLng]);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 60000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  // WebSocket for real-time updates
  useEffect(() => {
    wsManager.connect(WS_GUEST_URL);

    const unsubAlert = wsManager.on('zone_alert', (msg: any) => {
      setZoneAlert({ zone: msg.payload?.zone, severity: msg.payload?.severity });
      setTimeout(() => setZoneAlert(null), 10000);
    });

    const unsubClearing = wsManager.on('zone_clearing', () => {
      setZoneAlert(null);
    });

    return () => {
      unsubAlert();
      unsubClearing();
      wsManager.disconnect();
    };
  }, []);

  const topBarBottom = insets.top + 10 + 52;

  function toggleSheet() {
    const toValue = sheetOpen ? COLLAPSED : EXPANDED;
    Animated.spring(sheetAnim, { toValue, useNativeDriver: false, bounciness: 4 }).start();
    setSheetOpen(v => !v);
  }

  function openSearch() {
    setSearchOpen(true);
    Animated.spring(searchAnim, { toValue: 1, useNativeDriver: true, bounciness: 6 }).start();
  }

  function closeSearch() {
    Animated.timing(searchAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setSearchOpen(false);
      setSearchQuery('');
    });
  }

  async function selectDestination(dest: Destination) {
    setDestination(dest);
    closeSearch();

    try {
      const route = await calculateRoute(
        { lat: userLat, lon: userLng },
        { lat: dest.lat, lon: dest.lng },
        'walking',
      );
      if (route.polyline) {
        import('../../services/polyline').then(mod => {
          const coords = mod.decodePolyline(route.polyline);
          setRouteCoords(coords);
          webViewRef.current?.injectJavaScript(
            `window.dispatchEvent(new MessageEvent('message', {data: '${JSON.stringify({ type: 'navigate', lat: dest.lat, lng: dest.lng, polyline: coords.map(c => [c.lat, c.lng]) })}'})); true;`
          );
        }).catch(() => {
          webViewRef.current?.injectJavaScript(
            `window.dispatchEvent(new MessageEvent('message', {data: '${JSON.stringify({ type: 'navigate', lat: dest.lat, lng: dest.lng })}'})); true;`
          );
        });
      } else {
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new MessageEvent('message', {data: '${JSON.stringify({ type: 'navigate', lat: dest.lat, lng: dest.lng })}'})); true;`
        );
      }
    } catch {
      // Fallback: navigate without route
      webViewRef.current?.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message', {data: '${JSON.stringify({ type: 'navigate', lat: dest.lat, lng: dest.lng })}'})); true;`
      );
    }
  }

  function clearDestination() {
    setDestination(null);
    setRouteCoords([]);
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', {data: '${JSON.stringify({ type: 'clear' })}'})); true;`
    );
  }

  function recenter() {
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', {data: '${JSON.stringify({ type: 'recenter' })}'})); true;`
    );
  }

  const filtered = DESTINATIONS.filter(d =>
    searchQuery.trim() === '' ||
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.area.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fabBottom = sheetAnim.interpolate({
    inputRange: [COLLAPSED, EXPANDED],
    outputRange: [COLLAPSED + 16 + (insets.bottom || 0), EXPANDED + 16 + (insets.bottom || 0)],
  });

  const glassStyle = Platform.OS === 'ios'
    ? {}
    : { backgroundColor: isDark ? 'rgba(10,10,15,0.94)' : 'rgba(244,244,249,0.97)' };

  const mapHtml = buildMapHtml(
    incidents,
    userLat,
    userLng,
    destination,
    routeCoords,
    zoneAlert,
  );

  return (
    <View style={styles.root}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHtml }}
        style={StyleSheet.absoluteFill}
        scrollEnabled={false}
        overScrollMode="never"
      />

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 10, borderColor: C.borderStrong }]}>
        {Platform.OS === 'ios'
          ? <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, glassStyle]} />
        }
        <View style={styles.topInner}>
          <View style={styles.topLeft}>
            <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoMark} />
            <Text style={[styles.logoText, { color: C.textPrimary }]}>CampPulse</Text>
          </View>
          <View style={styles.topRight}>
            <View style={styles.alertChip}>
              <View style={styles.alertDot} />
              <Text style={styles.alertLabel}>{incidents.length} Active</Text>
            </View>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: C.glass.backgroundStrong }]}
              onPress={searchOpen ? closeSearch : openSearch}
            >
              <Ionicons name={searchOpen ? 'close' : 'search-outline'} size={17} color={C.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Zone alert banner */}
      {zoneAlert && (
        <View style={[styles.alertBanner, { top: topBarBottom + 8 }]}>
          <Ionicons name="warning" size={14} color="#fff" />
          <Text style={styles.alertBannerText}>
            {zoneAlert.zone} congested ({zoneAlert.severity})
          </Text>
        </View>
      )}

      {/* Search panel */}
      {searchOpen && (
        <Animated.View style={[
          styles.searchPanel,
          { top: topBarBottom + 8, borderColor: C.borderStrong },
          { opacity: searchAnim, transform: [{ translateY: searchAnim.interpolate({ inputRange: [0,1], outputRange: [-12, 0] }) }] },
        ]}>
          {Platform.OS === 'ios'
            ? <BlurView intensity={75} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, glassStyle]} />
          }
          <View style={styles.searchInputRow}>
            <Ionicons name="navigate-outline" size={16} color={C.accent} style={{ marginLeft: 4 }} />
            <TextInput
              autoFocus
              placeholder="Where to in camp?"
              placeholderTextColor={C.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: C.textPrimary }]}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={C.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.searchDivider, { backgroundColor: C.border }]} />

          <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {filtered.map((dest, i) => (
              <TouchableOpacity
                key={dest.id}
                onPress={() => selectDestination(dest)}
                style={[styles.resultRow, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.border }]}
                activeOpacity={0.7}
              >
                <View style={[styles.resultIcon, { backgroundColor: C.accent + '1A' }]}>
                  <Ionicons name="location-outline" size={14} color={C.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultName, { color: C.textPrimary }]}>{dest.name}</Text>
                  <Text style={[styles.resultArea, { color: C.textMuted }]}>{dest.area}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Active navigation banner */}
      {destination && !searchOpen && (
        <View style={[styles.navBanner, { top: topBarBottom + 8, borderColor: C.accent + '40' }]}>
          {Platform.OS === 'ios'
            ? <BlurView intensity={75} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            : <View style={[StyleSheet.absoluteFill, glassStyle]} />
          }
          <View style={[styles.navBannerAccent, { backgroundColor: C.accent }]} />
          <View style={styles.navBannerBody}>
            <Ionicons name="navigate" size={14} color={C.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.navLabel, { color: C.textMuted }]}>Navigating to</Text>
              <Text style={[styles.navDest, { color: C.textPrimary }]} numberOfLines={1}>{destination.name}</Text>
            </View>
            <TouchableOpacity onPress={clearDestination} style={[styles.navClose, { backgroundColor: C.surface2 }]}>
              <Ionicons name="close" size={14} color={C.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Quick actions */}
      <View style={[styles.quickStack, { bottom: COLLAPSED + 90 + (insets.bottom || 0) }]}>
        <TouchableOpacity
          onPress={recenter}
          style={[styles.quickBtn, { backgroundColor: isDark ? 'rgba(8,8,14,0.80)' : 'rgba(244,244,249,0.92)', borderColor: C.borderStrong }]}
          activeOpacity={0.8}
        >
          <Ionicons name="locate-outline" size={19} color={C.textSecondary} />
        </TouchableOpacity>
        {(['eye-outline', 'options-outline'] as const).map(icon => (
          <TouchableOpacity key={icon} style={[styles.quickBtn, { backgroundColor: isDark ? 'rgba(8,8,14,0.80)' : 'rgba(244,244,249,0.92)', borderColor: C.borderStrong }]} activeOpacity={0.8}>
            <Ionicons name={icon} size={19} color={C.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Report FAB */}
      <Animated.View style={[styles.fabWrap, { bottom: fabBottom }]}>
        <TouchableOpacity activeOpacity={0.88} onPress={() => router.push('/(tabs)/report')}>
          <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.fabLabel}>Report</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View style={[styles.sheet, { height: sheetAnim, paddingBottom: insets.bottom || 12 }]}>
        {Platform.OS === 'ios'
          ? <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(10,10,18,0.96)' : 'rgba(244,244,249,0.97)' }]} />
        }
        <View style={[styles.sheetTopLine, { backgroundColor: C.borderStrong }]} />

        <TouchableOpacity onPress={toggleSheet} style={styles.handleArea} activeOpacity={0.7}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, { color: C.textPrimary }]}>Nearby Activity</Text>
            <Ionicons name={sheetOpen ? 'chevron-down' : 'chevron-up'} size={15} color={C.textMuted} />
          </View>
        </TouchableOpacity>

        {sheetOpen && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.feed}>
            {incidents.length === 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: C.textMuted, fontSize: 13 }}>No incidents nearby</Text>
              </View>
            ) : (
              incidents.map(inc => (
                <View key={inc.id} style={[styles.feedCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <View style={[styles.feedStripe, { backgroundColor: SEV_COLOR[inc.type] }]} />
                  <View style={styles.feedBody}>
                    <View style={styles.feedRow}>
                      <Text style={[styles.feedName, { color: C.textPrimary }]}>{inc.label}</Text>
                      <Text style={[styles.feedTime, { color: C.textMuted }]}>{inc.time}</Text>
                    </View>
                    <View style={styles.feedSub}>
                      <View style={[styles.feedDot, { backgroundColor: SEV_COLOR[inc.type] }]} />
                      <Text style={[styles.feedArea, { color: C.textSecondary }]}>{inc.area}</Text>
                      <Text style={[styles.feedSevText, { color: SEV_COLOR[inc.type] }]}>{inc.type}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0F' },

  topBar: {
    position: 'absolute', left: 16, right: 16,
    borderRadius: Radius.xxl, overflow: 'hidden', borderWidth: 1,
  },
  topInner:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11 },
  topLeft:   { flexDirection: 'row', alignItems: 'center', gap: 9 },
  topRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark:  { width: 26, height: 26, borderRadius: 7 },
  logoText:  { fontFamily: Fonts.bold, fontSize: 15 },
  alertChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(239,68,68,0.14)', borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)', paddingHorizontal: 10, paddingVertical: 4 },
  alertDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: '#EF4444' },
  alertLabel:{ fontFamily: Fonts.semiBold, fontSize: 11, color: '#EF4444' },
  iconBtn:   { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  alertBanner: {
    position: 'absolute', left: 16, right: 16,
    padding: '10px 14px',
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.9)',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    zIndex: 20,
  },
  alertBannerText: { color: '#fff', fontSize: 13, fontFamily: Fonts.semiBold },

  searchPanel: {
    position: 'absolute', left: 16, right: 16,
    borderRadius: Radius.xxl, overflow: 'hidden', borderWidth: 1,
    maxHeight: 320,
  },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  searchInput:    { flex: 1, fontFamily: Fonts.regular, fontSize: 15, height: 24 },
  searchDivider:  { height: 1, marginHorizontal: 14 },
  resultsList:    { maxHeight: 240 },
  resultRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  resultIcon:     { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  resultName:     { fontFamily: Fonts.semiBold, fontSize: 14, marginBottom: 2 },
  resultArea:     { fontFamily: Fonts.regular, fontSize: 11 },

  navBanner: {
    position: 'absolute', left: 16, right: 16,
    borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1,
  },
  navBannerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  navBannerBody:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  navLabel:        { fontFamily: Fonts.regular, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  navDest:         { fontFamily: Fonts.semiBold, fontSize: 14 },
  navClose:        { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  quickStack: { position: 'absolute', right: 16, gap: 10 },
  quickBtn:   { width: 44, height: 44, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  fabWrap: { position: 'absolute', right: 16 },
  fab:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 13, borderRadius: Radius.full, shadowColor: '#00C896', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8 },
  fabLabel:{ fontFamily: Fonts.semiBold, fontSize: 15, color: '#fff' },

  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, overflow: 'hidden' },
  sheetTopLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  handleArea:   { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 6 },
  handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 10 },
  sheetHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle:   { fontFamily: Fonts.semiBold, fontSize: 14 },

  feed:       { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 10 },
  feedCard:   { flexDirection: 'row', borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  feedStripe: { width: 4 },
  feedBody:   { flex: 1, padding: 12, gap: 5 },
  feedRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedName:   { fontFamily: Fonts.semiBold, fontSize: 14 },
  feedTime:   { fontFamily: Fonts.regular, fontSize: 11 },
  feedSub:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  feedDot:    { width: 5, height: 5, borderRadius: 3 },
  feedArea:   { fontFamily: Fonts.regular, fontSize: 12, flex: 1 },
  feedSevText:{ fontFamily: Fonts.semiBold, fontSize: 11, textTransform: 'capitalize' },
});
