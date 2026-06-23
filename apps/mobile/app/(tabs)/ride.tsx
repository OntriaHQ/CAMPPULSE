import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { Fonts, GradientColors, Radius, Spacing } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useAuthWebSocket } from '@/hooks/useWebSocket';
import { storage } from '@/lib/storage';
import { cancelRide, getRide, requestRide, type Ride } from '@/services/rides';

interface PlacePoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

// Points inside the true Redemption City camp boundary
const PLACES: PlacePoint[] = [
  { id: 'p1', name: 'Main Auditorium',   lat: 6.8005, lon: 3.4447 },
  { id: 'p2', name: 'Festival Arena',    lat: 6.8040, lon: 3.4490 },
  { id: 'p3', name: 'North Gate',        lat: 6.8060, lon: 3.4460 },
  { id: 'd4', name: 'Medical Centre',    lat: 6.7990, lon: 3.4420 },
  { id: 'p5', name: 'Dining Hall',       lat: 6.8015, lon: 3.4470 },
  { id: 'p6', name: 'Camp Bus Terminal', lat: 6.8050, lon: 3.4435 },
];

const VEHICLES: { key: string; label: string; symbol: string }[] = [
  { key: 'tricycle', label: 'Camp Tricycle', symbol: '🛺' },
];

type ViewState = 'form' | 'searching' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export default function RideScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const styles = useStyles(C);

  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { storage.getAccessToken().then(setToken); }, []);
  const { subscribe } = useAuthWebSocket(token ?? '');

  const [pickup, setPickup] = useState<PlacePoint>(PLACES[0]);
  const [dropoff, setDropoff] = useState<PlacePoint>(PLACES[1]);
  const [vehicleType, setVehicleType] = useState('tricycle');
  const [pickerOpen, setPickerOpen] = useState<'pickup' | 'dropoff' | null>(null);

  const [view, setView] = useState<ViewState>('form');
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;
    const unsubAccepted = subscribe('ride_accepted', (msg: any) => {
      if (msg.payload?.ride_id !== ride?.id) return;
      setRide(r => r ? {
        ...r,
        status: 'accepted',
        driver_name: msg.payload.driver_name,
        driver_vehicle_type: msg.payload.driver_vehicle_type,
        eta_seconds: msg.payload.eta_seconds,
      } : r);
      setView('accepted');
    });
    const unsubStatus = subscribe('ride_status', (msg: any) => {
      if (msg.payload?.ride_id !== ride?.id) return;
      if (msg.payload.status === 'in_progress') setView('in_progress');
      if (msg.payload.status === 'completed') setView('completed');
    });
    const unsubCancelled = subscribe('ride_cancelled', (msg: any) => {
      if (msg.payload?.ride_id !== ride?.id) return;
      setCancelMessage('Your driver cancelled this ride.');
      setView('cancelled');
    });
    return () => { unsubAccepted(); unsubStatus(); unsubCancelled(); };
  }, [token, ride?.id, subscribe]);

  // Polling fallback in case a WS push is missed
  useEffect(() => {
    if (!ride || view === 'form' || view === 'completed' || view === 'cancelled') {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await getRide(ride.id);
        setRide(fresh);
        if (fresh.status === 'accepted') setView('accepted');
        if (fresh.status === 'in_progress') setView('in_progress');
        if (fresh.status === 'completed') setView('completed');
        if (fresh.status === 'cancelled') { setView('cancelled'); setCancelMessage('This ride was cancelled.'); }
      } catch {}
    }, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [ride?.id, view]);

  async function handleRequest() {
    setLoading(true);
    try {
      const created = await requestRide({
        pickup_lat: pickup.lat,
        pickup_lon: pickup.lon,
        pickup_label: pickup.name,
        dropoff_lat: dropoff.lat,
        dropoff_lon: dropoff.lon,
        dropoff_label: dropoff.name,
        vehicle_type: vehicleType,
      });
      setRide(created);
      setView('searching');
      
      // MOCK DEMO FLOW
      setTimeout(() => {
        setRide((r: any) => r ? {
          ...r,
          status: 'accepted',
          driver_name: 'Emmanuel (Tricycle)',
          driver_vehicle_type: 'Tricycle',
          eta_seconds: 120,
        } : r);
        setView('accepted');
        
        setTimeout(() => {
          setView('in_progress');
        }, 5000); // 5 seconds after accept, it starts the trip
      }, 3000); // 3 seconds to find driver
    } catch (e: any) {
      Alert.alert('Could not request ride', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!ride) return;
    try {
      await cancelRide(ride.id, 'Rider cancelled');
    } catch {}
    setView('form');
    setRide(null);
  }

  function resetToForm() {
    setView('form');
    setRide(null);
    setCancelMessage(null);
  }

  if (view === 'completed' && ride) {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <LinearGradient colors={['rgba(0,200,150,0.15)', 'transparent']} style={styles.successGlow} />
        <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </LinearGradient>
        <Text style={styles.title}>Trip Complete</Text>
        <Text style={styles.subtitle}>You arrived at {ride.dropoff_label ?? 'your destination'}</Text>
        <GlassCard style={{ marginTop: Spacing.lg, width: '100%' }} padding={16}>
          <View style={styles.fareRow}>
            <Text style={[styles.fareLabel, { color: C.textMuted }]}>Fare</Text>
            <Text style={[styles.fareValue, { color: C.textPrimary }]}>₦{ride.fare_estimate}</Text>
          </View>
          <View style={styles.fareRow}>
            <Text style={[styles.fareLabel, { color: C.textMuted }]}>Driver</Text>
            <Text style={[styles.fareValue, { color: C.textPrimary }]}>{ride.driver_name}</Text>
          </View>
        </GlassCard>
        <GradientButton label="Done" onPress={() => { resetToForm(); router.push('/(tabs)/map'); }} style={{ marginTop: Spacing.xl, width: 220 }} />
      </View>
    );
  }

  if (view === 'cancelled') {
    return (
      <View style={[styles.container, styles.centerContainer]}>
        <Text style={styles.title}>Ride Cancelled</Text>
        <Text style={styles.subtitle}>{cancelMessage ?? 'This ride was cancelled.'}</Text>
        <GradientButton label="Request Another Ride" onPress={resetToForm} style={{ marginTop: Spacing.xl, width: 240 }} />
      </View>
    );
  }

  if (view === 'searching' || view === 'accepted' || view === 'in_progress') {
    return (
      <View style={styles.container}>
        <View style={[styles.scroll, { paddingTop: insets.top + 20 }]}>
          <Text style={styles.title}>
            {view === 'searching' && 'Finding you a ride…'}
            {view === 'accepted' && 'Driver is on the way'}
            {view === 'in_progress' && 'Trip in progress'}
          </Text>
          <Text style={styles.subtitle}>
            {view === 'searching' && `Notified ${ride?.candidate_driver_count ?? 0} nearby driver(s)`}
            {view === 'accepted' && `${ride?.driver_name} · ${ride?.driver_vehicle_type}`}
            {view === 'in_progress' && `Heading to ${ride?.dropoff_label}`}
          </Text>

          <GlassCard style={{ marginTop: Spacing.lg }} padding={16}>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: C.textMuted }]}>From</Text>
              <Text style={[styles.fareValue, { color: C.textPrimary }]}>{ride?.pickup_label}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: C.textMuted }]}>To</Text>
              <Text style={[styles.fareValue, { color: C.textPrimary }]}>{ride?.dropoff_label}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: C.textMuted }]}>Estimated fare</Text>
              <Text style={[styles.fareValue, { color: C.accent }]}>₦{ride?.fare_estimate}</Text>
            </View>
            {ride?.eta_seconds != null && (
              <View style={styles.fareRow}>
                <Text style={[styles.fareLabel, { color: C.textMuted }]}>ETA</Text>
                <Text style={[styles.fareValue, { color: C.textPrimary }]}>{Math.ceil(ride.eta_seconds / 60)} min</Text>
              </View>
            )}
          </GlassCard>

          {view !== 'in_progress' && (
            <TouchableOpacity onPress={handleCancel} style={{ marginTop: Spacing.lg, alignSelf: 'center' }}>
              <Text style={[styles.cancelText, { color: C.error }]}>Cancel ride</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['rgba(14,165,233,0.08)', 'transparent']} style={styles.topGlow} pointerEvents="none" />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 140 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Request a Ride</Text>
        <Text style={styles.subtitle}>Get around Redemption Camp quickly</Text>

        <Text style={styles.sectionLabel}>Pickup</Text>
        <TouchableOpacity onPress={() => setPickerOpen(pickerOpen === 'pickup' ? null : 'pickup')}>
          <GlassCard style={styles.placeCard} padding={14}>
            <View style={[styles.dot, { backgroundColor: C.accent }]} />
            <Text style={[styles.placeText, { color: C.textPrimary }]}>{pickup.name}</Text>
          </GlassCard>
        </TouchableOpacity>
        {pickerOpen === 'pickup' && (
          <View style={styles.placeList}>
            {PLACES.map(p => (
              <TouchableOpacity key={p.id} onPress={() => { setPickup(p); setPickerOpen(null); }} style={styles.placeRow}>
                <Text style={[styles.placeRowText, { color: C.textSecondary }]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>Dropoff</Text>
        <TouchableOpacity onPress={() => setPickerOpen(pickerOpen === 'dropoff' ? null : 'dropoff')}>
          <GlassCard style={styles.placeCard} padding={14}>
            <View style={[styles.dot, { backgroundColor: '#00C896' }]} />
            <Text style={[styles.placeText, { color: C.textPrimary }]}>{dropoff.name}</Text>
          </GlassCard>
        </TouchableOpacity>
        {pickerOpen === 'dropoff' && (
          <View style={styles.placeList}>
            {PLACES.map(p => (
              <TouchableOpacity key={p.id} onPress={() => { setDropoff(p); setPickerOpen(null); }} style={styles.placeRow}>
                <Text style={[styles.placeRowText, { color: C.textSecondary }]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.sectionLabel}>Vehicle</Text>
        <View style={styles.vehicleRow}>
          {VEHICLES.map(v => {
            const selected = vehicleType === v.key;
            return (
              <TouchableOpacity key={v.key} onPress={() => setVehicleType(v.key)} style={styles.vehicleItemWrapper} activeOpacity={0.75}>
                {selected ? (
                  <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.vehicleItem}>
                    <Text style={styles.vehicleSymbol}>{v.symbol}</Text>
                    <Text style={[styles.vehicleLabel, { color: '#fff' }]}>{v.label}</Text>
                  </LinearGradient>
                ) : (
                  <GlassCard style={styles.vehicleItem} padding={0}>
                    <Text style={styles.vehicleSymbol}>{v.symbol}</Text>
                    <Text style={[styles.vehicleLabel, { color: C.textMuted }]}>{v.label}</Text>
                  </GlassCard>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <GradientButton label="Request Ride" onPress={handleRequest} loading={loading} style={{ marginTop: Spacing.xl }} />
      </ScrollView>
    </View>
  );
}

function useStyles(C: ReturnType<typeof useColors>) {
  return useMemo(() => StyleSheet.create({
    container:        { flex: 1, backgroundColor: C.background },
    centerContainer:  { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    topGlow:          { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
    scroll:           { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    title:            { fontFamily: Fonts.bold, fontSize: 26, color: C.textPrimary, marginBottom: 4, textAlign: 'center' },
    subtitle:         { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, marginBottom: Spacing.md, textAlign: 'center' },
    sectionLabel:     { fontFamily: Fonts.medium, fontSize: 13, color: C.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.8 },
    placeCard:        { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.lg },
    dot:              { width: 8, height: 8, borderRadius: 4 },
    placeText:        { fontFamily: Fonts.medium, fontSize: 14 },
    placeList:        { marginTop: 6, gap: 2 },
    placeRow:         { paddingVertical: 10, paddingHorizontal: 14 },
    placeRowText:     { fontFamily: Fonts.regular, fontSize: 13 },
    vehicleRow:       { flexDirection: 'row', gap: Spacing.sm },
    vehicleItemWrapper: { flex: 1, aspectRatio: 0.9 },
    vehicleItem:      { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.lg, gap: 6 },
    vehicleSymbol:    { fontSize: 22 },
    vehicleLabel:     { fontFamily: Fonts.medium, fontSize: 11 },
    fareRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    fareLabel:        { fontFamily: Fonts.regular, fontSize: 13 },
    fareValue:        { fontFamily: Fonts.semiBold, fontSize: 14 },
    cancelText:       { fontFamily: Fonts.medium, fontSize: 14 },
    successGlow:      { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
    successIcon:      { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    successIconText:  { fontSize: 36, color: '#fff' },
  }), [C]);
}
