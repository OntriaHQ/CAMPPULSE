import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Fonts, GradientColors, Radius } from '@/constants/theme';
import { useTheme, useColors } from '@/context/ThemeContext';

const CAMP_LAT = 6.7617;
const CAMP_LNG = 3.6664;

const INCIDENTS = [
  { id: '1', lat: 6.7635, lng: 3.6650, type: 'critical', label: 'Flooding',         area: 'Camp Road',      time: '2h ago'    },
  { id: '2', lat: 6.7650, lng: 3.6680, type: 'high',     label: 'Crowd Congestion', area: 'North Gate',     time: '5h ago'    },
  { id: '3', lat: 6.7600, lng: 3.6700, type: 'medium',   label: 'Streetlight Out',  area: 'Festival Arena', time: 'Yesterday' },
  { id: '4', lat: 6.7580, lng: 3.6640, type: 'low',      label: 'Water Supply',     area: 'Canaan Land',    time: '3d ago'    },
];

const SEV_COLOR: Record<string, string> = {
  critical: '#EF4444',
  high:     '#F97316',
  medium:   '#EAB308',
  low:      '#22C55E',
};

const mapHtml = `<!DOCTYPE html>
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
  </style>
</head>
<body><div id="map"></div>
<script>
  const map = L.map('map',{center:[${CAMP_LAT},${CAMP_LNG}],zoom:15,zoomControl:false,attributionControl:false});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:20,subdomains:'abcd'}).addTo(map);

  const incidents = ${JSON.stringify(INCIDENTS)};
  const colors = ${JSON.stringify(SEV_COLOR)};

  incidents.forEach(inc => {
    const el = document.createElement('div');
    el.className = 'pin';
    el.style.background = colors[inc.type];
    el.style.boxShadow = '0 0 10px '+colors[inc.type];
    const icon = L.divIcon({html:el.outerHTML,className:'',iconSize:[22,22],iconAnchor:[11,11]});
    L.marker([inc.lat,inc.lng],{icon}).addTo(map);
  });

  const uEl = document.createElement('div');
  uEl.className='user';
  const uIcon = L.divIcon({html:uEl.outerHTML,className:'',iconSize:[14,14],iconAnchor:[7,7]});
  L.marker([${CAMP_LAT},${CAMP_LNG}],{icon:uIcon}).addTo(map);
</script>
</body></html>`;

const COLLAPSED = 72;
const EXPANDED  = 340;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const C = useColors();
  const sheetAnim = useRef(new Animated.Value(COLLAPSED)).current;
  const [sheetOpen, setSheetOpen] = useState(false);

  function toggleSheet() {
    const toValue = sheetOpen ? COLLAPSED : EXPANDED;
    Animated.spring(sheetAnim, { toValue, useNativeDriver: false, bounciness: 4 }).start();
    setSheetOpen(v => !v);
  }

  const fabBottom = sheetAnim.interpolate({
    inputRange: [COLLAPSED, EXPANDED],
    outputRange: [COLLAPSED + 16 + (insets.bottom || 0), EXPANDED + 16 + (insets.bottom || 0)],
  });

  return (
    <View style={styles.root}>
      {/* Full-screen map */}
      <WebView
        source={{ html: mapHtml }}
        style={StyleSheet.absoluteFill}
        scrollEnabled={false}
        overScrollMode="never"
      />

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + 10, borderColor: C.borderStrong }]}>
        {Platform.OS === 'ios'
          ? <BlurView intensity={70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          : <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(10,10,15,0.88)' : 'rgba(244,244,249,0.94)' }]} />
        }
        <View style={styles.topInner}>
          <View style={styles.topLeft}>
            <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoMark} />
            <Text style={[styles.logoText, { color: C.textPrimary }]}>CampPulse</Text>
          </View>
          <View style={styles.topRight}>
            <View style={styles.alertChip}>
              <View style={styles.alertDot} />
              <Text style={styles.alertLabel}>{INCIDENTS.length} Active</Text>
            </View>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: C.glass.backgroundStrong }]}>
              <Ionicons name="search-outline" size={17} color={C.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Quick actions */}
      <View style={[styles.quickStack, { bottom: COLLAPSED + 90 + (insets.bottom || 0) }]}>
        {([ 'locate-outline', 'eye-outline', 'options-outline' ] as const).map(icon => (
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
            {INCIDENTS.map(inc => (
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
            ))}
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
    borderRadius: Radius.xxl, overflow: 'hidden',
    borderWidth: 1,
  },
  topInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11 },
  topLeft:  { flexDirection: 'row', alignItems: 'center', gap: 9 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: { width: 26, height: 26, borderRadius: 7 },
  logoText: { fontFamily: Fonts.bold, fontSize: 15 },
  alertChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(239,68,68,0.14)', borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(239,68,68,0.30)', paddingHorizontal: 10, paddingVertical: 4 },
  alertDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: '#EF4444' },
  alertLabel:{ fontFamily: Fonts.semiBold, fontSize: 11, color: '#EF4444' },
  iconBtn:   { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },

  quickStack: { position: 'absolute', right: 16, gap: 10 },
  quickBtn:   { width: 44, height: 44, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  fabWrap: { position: 'absolute', right: 16 },
  fab:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 13, borderRadius: Radius.full, shadowColor: '#00C896', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 12, elevation: 8 },
  fabLabel:{ fontFamily: Fonts.semiBold, fontSize: 15, color: '#fff' },

  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, overflow: 'hidden' },
  sheetTopLine:{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 },
  handleArea:  { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 6 },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginBottom: 10 },
  sheetHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle:  { fontFamily: Fonts.semiBold, fontSize: 14 },

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
