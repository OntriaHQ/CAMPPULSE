import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/context/ThemeContext';
import { useAuthWebSocket } from '@/hooks/useWebSocket';
import { useLocation } from '@/hooks/useLocation';
import { storage } from '@/lib/storage';
import { acceptRide, completeRide, startRide, type Ride } from '@/services/rides';

interface IncomingRequest {
  ride_id: string;
  pickup_label: string | null;
  dropoff_label: string | null;
  distance_metres: number;
  pickup_distance_metres: number;
  fare_estimate: string;
  vehicle_type: string;
}

export default function DriveScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const styles = useStyles(C);
  const { user } = useAuth();

  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { storage.getAccessToken().then(setToken); }, []);

  const { subscribe, connected } = useAuthWebSocket(token ?? '');
  useLocation({ sendPings: true, token: token ?? undefined });

  const [incoming, setIncoming] = useState<IncomingRequest | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    const unsubRequest = subscribe('ride_request', (msg: any) => {
      if (activeRide) return; // already on a trip — ignore new requests
      setIncoming(msg.payload);
    });
    const unsubUnavailable = subscribe('ride_unavailable', (msg: any) => {
      setIncoming(curr => (curr?.ride_id === msg.payload?.ride_id ? null : curr));
    });
    const unsubCancelled = subscribe('ride_cancelled', (msg: any) => {
      setActiveRide(curr => (curr?.id === msg.payload?.ride_id ? null : curr));
    });

    // DEMO MOCK: Simulate an incoming ride request after 4 seconds
    const demoTimeout = setTimeout(() => {
      if (!activeRide && !incoming) {
        setIncoming({
          ride_id: 'ride-demo-777',
          pickup_label: 'The Arena (Main Auditorium)',
          dropoff_label: 'Haggai Estate 3',
          distance_metres: 1200,
          pickup_distance_metres: 450,
          fare_estimate: '1,500',
          vehicle_type: 'standard'
        });
      }
    }, 4000);

    return () => { unsubRequest(); unsubUnavailable(); unsubCancelled(); clearTimeout(demoTimeout); };
  }, [token, activeRide, subscribe, incoming]);

  async function handleAccept() {
    if (!incoming) return;
    setBusy(true);
    try {
      const ride = await acceptRide(incoming.ride_id);
      setActiveRide(ride);
      setIncoming(null);
    } catch (e: any) {
      Alert.alert('Could not accept', e?.message ?? 'This ride may have just been taken.');
      setIncoming(null);
    } finally {
      setBusy(false);
    }
  }

  function handleDecline() {
    setIncoming(null);
  }

  async function handleStart() {
    if (!activeRide) return;
    setBusy(true);
    try {
      const ride = await startRide(activeRide.id);
      setActiveRide(ride);
    } catch (e: any) {
      Alert.alert('Could not start trip', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (!activeRide) return;
    setBusy(true);
    try {
      await completeRide(activeRide.id);
      setActiveRide(null);
    } catch (e: any) {
      Alert.alert('Could not complete trip', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (user?.role !== 'driver') {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.title}>Driver Mode</Text>
        <Text style={styles.subtitle}>This screen is only available to driver accounts.</Text>
        <GradientButton label="Back" onPress={() => router.back()} style={{ marginTop: Spacing.lg, width: 160 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 140 }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Driver Mode</Text>
          <View style={[styles.statusPill, { backgroundColor: (connected ? '#22C55E' : '#94A3B8') + '22' }]}>
            <View style={[styles.statusDot, { backgroundColor: connected ? '#22C55E' : '#94A3B8' }]} />
            <Text style={[styles.statusText, { color: connected ? '#22C55E' : '#94A3B8' }]}>
              {connected ? 'Online' : 'Connecting…'}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Sharing your location so nearby riders can find you</Text>

        {activeRide ? (
          <GlassCard style={{ marginTop: Spacing.lg }} padding={16}>
            <Text style={[styles.cardTitle, { color: C.textPrimary }]}>
              {activeRide.status === 'accepted' ? 'Heading to pickup' : 'Trip in progress'}
            </Text>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: C.textMuted }]}>Rider</Text>
              <Text style={[styles.fareValue, { color: C.textPrimary }]}>{activeRide.rider_name}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: C.textMuted }]}>Pickup</Text>
              <Text style={[styles.fareValue, { color: C.textPrimary }]}>{activeRide.pickup_label}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: C.textMuted }]}>Dropoff</Text>
              <Text style={[styles.fareValue, { color: C.textPrimary }]}>{activeRide.dropoff_label}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: C.textMuted }]}>Fare</Text>
              <Text style={[styles.fareValue, { color: C.accent }]}>₦{activeRide.fare_estimate}</Text>
            </View>

            {activeRide.status === 'accepted' && (
              <GradientButton label="Start Trip" onPress={handleStart} loading={busy} style={{ marginTop: Spacing.md }} />
            )}
            {activeRide.status === 'in_progress' && (
              <GradientButton label="Complete Trip" onPress={handleComplete} loading={busy} style={{ marginTop: Spacing.md }} />
            )}
          </GlassCard>
        ) : incoming ? (
          <GlassCard style={{ marginTop: Spacing.lg }} padding={16}>
            <Text style={[styles.cardTitle, { color: C.textPrimary }]}>New ride request</Text>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: C.textMuted }]}>Pickup</Text>
              <Text style={[styles.fareValue, { color: C.textPrimary }]}>{incoming.pickup_label}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: C.textMuted }]}>Dropoff</Text>
              <Text style={[styles.fareValue, { color: C.textPrimary }]}>{incoming.dropoff_label}</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: C.textMuted }]}>Distance to pickup</Text>
              <Text style={[styles.fareValue, { color: C.textPrimary }]}>{Math.round(incoming.pickup_distance_metres)}m</Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={[styles.fareLabel, { color: C.textMuted }]}>Fare</Text>
              <Text style={[styles.fareValue, { color: C.accent }]}>₦{incoming.fare_estimate}</Text>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={handleDecline} style={[styles.declineBtn, { borderColor: C.border }]}>
                <Text style={[styles.declineText, { color: C.textSecondary }]}>Decline</Text>
              </TouchableOpacity>
              <GradientButton label="Accept" onPress={handleAccept} loading={busy} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        ) : (
          <GlassCard style={{ marginTop: Spacing.lg, alignItems: 'center', paddingVertical: 32 }}>
            <Text style={[styles.waitingText, { color: C.textMuted }]}>Waiting for ride requests…</Text>
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

function useStyles(C: ReturnType<typeof useColors>) {
  return useMemo(() => StyleSheet.create({
    container:   { flex: 1, backgroundColor: C.background },
    center:      { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    scroll:      { paddingHorizontal: Spacing.lg },
    headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title:       { fontFamily: Fonts.bold, fontSize: 26, color: C.textPrimary },
    subtitle:    { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, marginTop: 4 },
    statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full },
    statusDot:   { width: 6, height: 6, borderRadius: 3 },
    statusText:  { fontFamily: Fonts.medium, fontSize: 11 },
    cardTitle:   { fontFamily: Fonts.semiBold, fontSize: 16, marginBottom: 8 },
    fareRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    fareLabel:   { fontFamily: Fonts.regular, fontSize: 13 },
    fareValue:   { fontFamily: Fonts.semiBold, fontSize: 14 },
    actionRow:   { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    declineBtn:  { flex: 1, borderWidth: 1, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
    declineText: { fontFamily: Fonts.semiBold, fontSize: 15 },
    waitingText: { fontFamily: Fonts.medium, fontSize: 14 },
  }), [C]);
}
