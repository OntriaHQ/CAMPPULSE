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
import { Ionicons } from '@expo/vector-icons';
import { Fonts, GradientColors, Radius } from '@/constants/theme';
import { useTheme, useColors } from '@/context/ThemeContext';
import { getIncidentsNearby } from '../../services/incidents';
import { calculateRoute } from '../../services/routes';
import { wsManager } from '../../services/websocket';
import { useLocation } from '../../hooks/useLocation';
import CampMap, { MapMarker, MapLine } from '../../components/map/CampMap';
import { REDEMPTION_CITY_CENTER } from '@camppulse/map-config';
import { decodePolyline } from '../../services/polyline';

const WS_GUEST_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000')
  .replace(/^http/, 'ws') + '/ws/location/guest';

const SEV_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  low:      '#22C55E',
};

interface Destination {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
}

// Adjusted destinations to be centered around the new coordinates
const DESTINATIONS: Destination[] = [
  { id: 'd1', name: 'Main Auditorium',     area: 'Central Camp',     lat: 6.9271, lng: 3.3958 },
  { id: 'd2', name: 'Festival Arena',      area: 'East Wing',        lat: 6.9284, lng: 3.3974 },
  { id: 'd3', name: 'North Gate',          area: 'Camp Entrance',    lat: 6.9304, lng: 3.3954 },
  { id: 'd4', name: 'Medical Centre',      area: 'South Block',      lat: 6.9254, lng: 3.3944 },
  { id: 'd5', name: 'Canaan Land Estate',  area: 'Residential Zone', lat: 6.9234, lng: 3.3934 },
  { id: 'd6', name: 'Camp Bus Terminal',   area: 'West Gate',        lat: 6.9294, lng: 3.3994 },
  { id: 'd7', name: 'Dining Hall',         area: 'Central Camp',     lat: 6.9264, lng: 3.3964 },
  { id: 'd8', name: 'Camp Bookshop',       area: 'Admin Block',      lat: 6.9274, lng: 3.3954 },
  { id: 'd9', name: 'VIP Guest House',     area: 'North Wing',       lat: 6.9289, lng: 3.3949 },
  { id: 'd10', name: 'Prayer Mountain',    area: 'Mountain Zone',    lat: 6.9214, lng: 3.3924 },
];

const COLLAPSED = 72;
const EXPANDED  = 340;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const C = useColors();

  const sheetAnim  = useRef(new Animated.Value(COLLAPSED)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;

  const [sheetOpen,       setSheetOpen]       = useState(false);
  const [searchOpen,      setSearchOpen]       = useState(false);
  const [searchQuery,     setSearchQuery]      = useState('');
  const [destination,     setDestination]      = useState<Destination | null>(null);
  const [incidents,       setIncidents]       = useState<any[]>([]);
  const [routeLine,       setRouteLine]       = useState<MapLine | null>(null);
  const [zoneAlert,       setZoneAlert]       = useState<{ zone: string; severity: string } | null>(null);

  const { location: userLocation } = useLocation({ sendPings: false });

  const userLat = userLocation?.latitude ?? REDEMPTION_CITY_CENTER.lat;
  const userLng = userLocation?.longitude ?? REDEMPTION_CITY_CENTER.lon;

  // Fetch incidents from API
  const fetchIncidents = useCallback(async () => {
    try {
      const data = await getIncidentsNearby(userLat, userLng, 2000);
      setIncidents(data.map(inc => ({
        id: inc.id,
        lat: inc.location.lat,
        lng: inc.location.lon,
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
        const coords = decodePolyline(route.polyline);
        setRouteLine({
          id: 'route',
          coordinates: coords,
          color: '#00C896',
          width: 5,
        });
      }
    } catch {
      // route fail, just show dest marker
    }
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

  const fabBottom = sheetAnim.interpolate({
    inputRange: [COLLAPSED, EXPANDED],
    outputRange: [COLLAPSED + 16 + (insets.bottom || 0), EXPANDED + 16 + (insets.bottom || 0)],
  });

  const glassStyle = Platform.OS === 'ios'
    ? {}
    : { backgroundColor: isDark ? 'rgba(10,10,15,0.94)' : 'rgba(244,244,249,0.97)' };

  const markers: MapMarker[] = [
    {
      id: 'current-user',
      lat: userLat,
      lng: userLng,
      color: '#0EA5E9',
      size: 16,
    },
    ...incidents.map(inc => ({
      id: inc.id,
      lat: inc.lat,
      lng: inc.lng,
      color: SEV_COLOR[inc.type] || '#888',
      size: 14,
    })),
  ];

  if (destination) {
    markers.push({
      id: 'dest',
      lat: destination.lat,
      lng: destination.lng,
      color: '#00C896',
      size: 20,
    });
  }

  return (
    <View style={styles.root}>
      <CampMap
        markers={markers}
        lines={routeLine ? [routeLine] : []}
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
          <div style={styles.searchInputRow}>
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
          </div>

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
          onPress={() => {}}
          style={[styles.quickBtn, { backgroundColor: isDark ? 'rgba(8,8,14,0.80)' : 'rgba(244,244,249,0.92)', borderColor: C.borderStrong }]}
          activeOpacity={0.8}
        >
          <Ionicons name="locate-outline" size={19} color={C.textSecondary} />
        </TouchableOpacity>
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
    borderRadius: Radius.xxl, overflow: 'hidden', borderWidth: 1, zIndex: 100
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
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.9)',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    zIndex: 20,
  },
  alertBannerText: { color: '#fff', fontSize: 13, fontFamily: Fonts.semiBold },

  searchPanel: {
    position: 'absolute', left: 16, right: 16,
    borderRadius: Radius.xxl, overflow: 'hidden', borderWidth: 1,
    maxHeight: 320, zIndex: 150
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
    borderRadius: Radius.xl, overflow: 'hidden', borderWidth: 1, zIndex: 50
  },
  navBannerAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  navBannerBody:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  navLabel:        { fontFamily: Fonts.regular, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  navDest:         { fontFamily: Fonts.semiBold, fontSize: 14 },
  navClose:        { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  quickStack: { position: 'absolute', right: 16, gap: 10, zIndex: 40 },
  quickBtn:   { width: 44, height: 44, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  fabWrap: { position: 'absolute', right: 16, zIndex: 40 },
  fab:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 13, borderRadius: Radius.full, shadowColor: '#00C896', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8 },
  fabLabel:{ fontFamily: Fonts.semiBold, fontSize: 15, color: '#fff' },

  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, overflow: 'hidden', zIndex: 200 },
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
