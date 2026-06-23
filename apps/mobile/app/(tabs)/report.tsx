import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useMemo, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { Input } from '@/components/ui/Input';
import { Fonts, GradientColors, Radius, Spacing } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';

type IncidentType = 'security' | 'flooding' | 'road_damage' | 'streetlight' | 'water_supply' | 'congestion' | 'power_outage' | 'lost_person' | 'sanitation' | 'facility_damage' | 'other';
type Severity = 'low' | 'medium' | 'high' | 'critical';

const INCIDENT_TYPES: { key: IncidentType; label: string; symbol: string }[] = [
  { key: 'security',        label: 'Security SOS',   symbol: '🛡️'  },
  { key: 'flooding',        label: 'Flooding',       symbol: '~'   },
  { key: 'road_damage',     label: 'Road Damage',    symbol: '◎'   },
  { key: 'streetlight',     label: 'Streetlight',    symbol: '◈'   },
  { key: 'water_supply',    label: 'Water Supply',   symbol: '≋'   },
  { key: 'congestion',      label: 'Congestion',     symbol: '⊞'   },
  { key: 'power_outage',    label: 'Power Out',      symbol: '◉'   },
  { key: 'lost_person',     label: 'Lost Person',    symbol: '◯'   },
  { key: 'sanitation',      label: 'Sanitation',     symbol: '◻'   },
  { key: 'facility_damage', label: 'Facility',       symbol: '⊕'   },
  { key: 'other',           label: 'Other',          symbol: '···' },
];

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const C = useColors();
  const styles = useStyles(C);

  const SEVERITIES: { key: Severity; label: string; color: string }[] = [
    { key: 'low',      label: 'Low',      color: C.severity.low      },
    { key: 'medium',   label: 'Medium',   color: C.severity.medium   },
    { key: 'high',     label: 'High',     color: C.severity.high     },
    { key: 'critical', label: 'Critical', color: C.severity.critical },
  ];

  const [incidentType, setIncidentType] = useState<IncidentType | null>(null);
  const [severity, setSeverity] = useState<Severity>('low');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('Detecting location...');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setLocationLabel('Location permission denied'); return; }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
        setLocationLabel(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
      } catch { setLocationLabel('Could not detect location'); }
    })();
  }, []);

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo access to attach an image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  }

  async function handleCameraPhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow camera access to take a photo.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  }

  async function handleSubmit() {
    if (!incidentType) { Alert.alert('Select a type', 'Please choose what type of issue you are reporting.'); return; }
    if (!location) { Alert.alert('No location', 'We could not detect your location. Please try again.'); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('type', incidentType);
      formData.append('severity', severity);
      formData.append('lat', String(location.lat));
      formData.append('lon', String(location.lon));
      if (description.trim()) formData.append('description', description.trim());
      if (photo) formData.append('photo', { uri: photo, name: 'photo.jpg', type: 'image/jpeg' } as never);

      const accessToken = await import('@/lib/storage').then(m => m.storage.getAccessToken());
      const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

      const res = await fetch(`${BASE_URL}/api/v1/incidents`, {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body: formData,
      });

      if (res.ok) {
        setSubmitted(true);
        DeviceEventEmitter.emit('demo_incident_reported', { type: incidentType, severity });
      } else {
        const data = await res.json();
        Alert.alert('Error', data?.error?.message ?? 'Submission failed. Please try again.');
      }
    } catch { Alert.alert('Error', 'Could not submit report. Check your connection.'); }
    finally { setLoading(false); }
  }

  if (submitted) {
    return (
      <View style={[styles.container, styles.successContainer]}>
        <LinearGradient colors={['rgba(0,200,150,0.15)', 'transparent']} style={styles.successGlow} />
        <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.successIcon}>
          <Text style={styles.successIconText}>✓</Text>
        </LinearGradient>
        <Text style={styles.successTitle}>Report Submitted</Text>
        <Text style={styles.successSub}>Your report has been received and{'\n'}the camp team has been notified.</Text>
        <GradientButton label="Back to Map" onPress={() => { setSubmitted(false); router.push('/(tabs)/map'); }} style={{ marginTop: Spacing.xl, width: 220 }} />
        <TouchableOpacity onPress={() => { setSubmitted(false); setIncidentType(null); setDescription(''); setPhoto(null); }} style={{ marginTop: Spacing.md }}>
          <Text style={styles.reportAnotherText}>Report another issue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['rgba(14,165,233,0.08)', 'transparent']} style={styles.topGlow} pointerEvents="none" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 140 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Report an Issue</Text>
          <Text style={styles.subtitle}>Help keep Redemption Camp running smoothly</Text>

          <Text style={styles.sectionLabel}>What is happening?</Text>
          <View style={styles.typeGrid}>
            {INCIDENT_TYPES.map((t) => {
              const selected = incidentType === t.key;
              return (
                <TouchableOpacity key={t.key} onPress={() => setIncidentType(t.key)} style={styles.typeItemWrapper} activeOpacity={0.75}>
                  {selected ? (
                    <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.typeItem}>
                      <Text style={[styles.typeSymbol, { color: '#fff' }]}>{t.symbol}</Text>
                      <Text style={[styles.typeLabel, { color: '#fff' }]}>{t.label}</Text>
                    </LinearGradient>
                  ) : (
                    <GlassCard style={styles.typeItem} padding={0}>
                      <Text style={[styles.typeSymbol, { color: C.textMuted }]}>{t.symbol}</Text>
                      <Text style={[styles.typeLabel, { color: C.textMuted }]}>{t.label}</Text>
                    </GlassCard>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Severity</Text>
          <View style={styles.severityRow}>
            {SEVERITIES.map((s) => {
              const selected = severity === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setSeverity(s.key)}
                  style={[
                    styles.severityPill,
                    { borderColor: selected ? s.color : C.border },
                    selected && { backgroundColor: s.color + '22' },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.severityText, { color: selected ? s.color : C.textSecondary }]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Description  <Text style={[styles.optional, { color: C.textMuted }]}>(optional)</Text></Text>
          <Input placeholder="Describe the issue..." value={description} onChangeText={setDescription} multiline numberOfLines={4} style={{ height: 100, textAlignVertical: 'top', paddingTop: 14 }} />

          <Text style={styles.sectionLabel}>Photo  <Text style={[styles.optional, { color: C.textMuted }]}>(optional)</Text></Text>
          {photo ? (
            <View style={styles.photoPreviewWrapper}>
              <Image source={{ uri: photo }} style={styles.photoPreview} />
              <TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)}>
                <Text style={[styles.removePhotoText, { color: C.error }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoRow}>
              <TouchableOpacity onPress={handleCameraPhoto} style={styles.photoOptionWrapper} activeOpacity={0.8}>
                <GlassCard style={styles.photoOption} padding={20}>
                  <Text style={[styles.photoOptionSymbol, { color: C.textMuted }]}>[ ]</Text>
                  <Text style={[styles.photoOptionLabel, { color: C.textSecondary }]}>Camera</Text>
                </GlassCard>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickPhoto} style={styles.photoOptionWrapper} activeOpacity={0.8}>
                <GlassCard style={styles.photoOption} padding={20}>
                  <Text style={[styles.photoOptionSymbol, { color: C.textMuted }]}>[ ]</Text>
                  <Text style={[styles.photoOptionLabel, { color: C.textSecondary }]}>Gallery</Text>
                </GlassCard>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.sectionLabel}>Location</Text>
          <GlassCard style={styles.locationCard} padding={14}>
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: location ? C.accent : C.textMuted }]} />
              <Text style={[styles.locationText, { color: location ? C.accent : C.textMuted }]}>{locationLabel}</Text>
            </View>
          </GlassCard>

          <GradientButton label="Submit Report" onPress={handleSubmit} loading={loading} style={{ marginTop: Spacing.lg }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function useStyles(C: ReturnType<typeof useColors>) {
  return useMemo(() => StyleSheet.create({
    container:        { flex: 1, backgroundColor: C.background },
    topGlow:          { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
    scroll:           { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    title:            { fontFamily: Fonts.bold, fontSize: 26, color: C.textPrimary, marginBottom: 4 },
    subtitle:         { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary, marginBottom: Spacing.md },
    sectionLabel:     { fontFamily: Fonts.medium, fontSize: 13, color: C.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.8 },
    optional:         { textTransform: 'none', letterSpacing: 0 },
    typeGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    typeItemWrapper:  { width: '22%', aspectRatio: 0.9 },
    typeItem:         { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.lg, gap: 6 },
    typeSymbol:       { fontSize: 18 },
    typeLabel:        { fontFamily: Fonts.medium, fontSize: 10, textAlign: 'center' },
    severityRow:      { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    severityPill:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1 },
    severityText:     { fontFamily: Fonts.medium, fontSize: 13 },
    photoRow:         { flexDirection: 'row', gap: Spacing.sm },
    photoOptionWrapper: { flex: 1 },
    photoOption:      { alignItems: 'center', justifyContent: 'center', borderRadius: Radius.xl, borderStyle: 'dashed', minHeight: 100 },
    photoOptionSymbol:{ fontSize: 22, marginBottom: 6 },
    photoOptionLabel: { fontFamily: Fonts.medium, fontSize: 13 },
    photoPreviewWrapper: { borderRadius: Radius.xl, overflow: 'hidden', position: 'relative' },
    photoPreview:     { width: '100%', height: 180, borderRadius: Radius.xl },
    removePhoto:      { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.full },
    removePhotoText:  { fontFamily: Fonts.medium, fontSize: 12 },
    locationCard:     { borderRadius: Radius.lg },
    locationRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
    locationDot:      { width: 8, height: 8, borderRadius: 4 },
    locationText:     { fontFamily: Fonts.regular, fontSize: 13 },
    successContainer: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    successGlow:      { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
    successIcon:      { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    successIconText:  { fontSize: 36, color: '#fff' },
    successTitle:     { fontFamily: Fonts.bold, fontSize: 26, color: C.textPrimary, marginBottom: Spacing.sm },
    successSub:       { fontFamily: Fonts.regular, fontSize: 15, color: C.textSecondary, textAlign: 'center', lineHeight: 24 },
    reportAnotherText:{ fontFamily: Fonts.medium, fontSize: 14, color: C.textMuted },
  }), [C]);
}
