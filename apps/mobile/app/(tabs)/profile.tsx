import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/ui/GradientButton';
import { Fonts, GradientColors, Radius } from '@/constants/theme';
import { useColors, useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

const KYC_META: Record<string, { label: string; colorKey: 'low' | 'medium' | 'critical' }> = {
  verified: { label: 'Verified',            colorKey: 'low'      },
  pending:  { label: 'Pending Verification', colorKey: 'medium'   },
  rejected: { label: 'Rejected',            colorKey: 'critical'  },
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { toggle, isDark } = useTheme();
  const C = useColors();
  const [loggingOut, setLoggingOut] = useState(false);
  const styles = useStyles(C);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const kycMeta = user?.kyc_status ? (KYC_META[user.kyc_status] ?? KYC_META.pending) : KYC_META.pending;
  const kycColor = C.severity[kycMeta.colorKey];

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try { await logout(); router.replace('/(auth)/login'); }
          finally { setLoggingOut(false); }
        },
      },
    ]);
  }

  const SETTINGS = useMemo(() => [
    { key: 'notifications', label: 'Notifications',  sub: 'Alerts and zone broadcasts' },
    { key: 'password',      label: 'Change Password', sub: 'Update account security'    },
    { key: 'help',          label: 'Help & Support',  sub: 'FAQs and contact info'      },
    { key: 'about',         label: 'About CampPulse', sub: 'Version 1.0.0'             },
  ], []);

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <LinearGradient
          colors={['rgba(0,200,150,0.14)', 'rgba(14,165,233,0.08)', 'transparent']}
          style={[styles.hero, { paddingTop: insets.top + 24 }]}
        >
          <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
            <View style={[styles.avatarInner, { backgroundColor: C.surface2 }]}>
              <Text style={[styles.avatarText, { color: C.textPrimary }]}>{initials}</Text>
            </View>
          </LinearGradient>
          <Text style={[styles.name, { color: C.textPrimary }]}>{user?.full_name ?? 'User'}</Text>
          <Text style={[styles.role, { color: C.textSecondary }]}>
            {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Resident'}
            {user?.zone ? `  ·  ${user.zone}` : ''}
          </Text>
          <View style={[styles.kycPill, { borderColor: kycColor + '50', backgroundColor: kycColor + '18' }]}>
            <View style={[styles.kycDot, { backgroundColor: kycColor }]} />
            <Text style={[styles.kycText, { color: kycColor }]}>{kycMeta.label}</Text>
          </View>
        </LinearGradient>

        <View style={styles.body}>
          <View style={[styles.statsRow, { backgroundColor: C.surface, borderColor: C.border }]}>
            {[{ n: '15', label: 'Reports' }, { n: '3', label: 'Active' }, { n: '12', label: 'Resolved' }].map((s, i, arr) => (
              <View key={s.label} style={[styles.statCell, i < arr.length - 1 && { borderRightWidth: 1, borderRightColor: C.border }]}>
                <Text style={[styles.statNum, { color: C.accent }]}>{s.n}</Text>
                <Text style={[styles.statLabel, { color: C.textMuted }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: C.textMuted }]}>Account Info</Text>
            <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              {[
                { label: 'Email',   value: user?.email   ?? '—'               },
                { label: 'Phone',   value: user?.phone   ?? 'No phone added'  },
                { label: 'Zone',    value: user?.zone    ?? 'No zone set'     },
                { label: 'Camp ID', value: user?.camp_id ?? 'Not assigned'    },
              ].map((row, i, arr) => (
                <View key={row.label}>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: C.textMuted }]}>{row.label}</Text>
                    <Text style={[styles.infoValue, { color: C.textPrimary }]} numberOfLines={1}>{row.value}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={[styles.divider, { backgroundColor: C.border }]} />}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: C.textMuted }]}>Settings</Text>
            <View style={[styles.card, { backgroundColor: C.surface, borderColor: C.border }]}>
              {/* Theme toggle row */}
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: C.textPrimary }]}>Dark Mode</Text>
                  <Text style={[styles.settingSub, { color: C.textMuted }]}>Switch app appearance</Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggle}
                  trackColor={{ false: C.borderStrong, true: C.accent + 'BB' }}
                  thumbColor={isDark ? C.accent : C.textMuted}
                />
              </View>
              <View style={[styles.divider, { backgroundColor: C.border }]} />
              {SETTINGS.map((s, i, arr) => (
                <View key={s.key}>
                  <TouchableOpacity style={styles.settingRow} activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.settingLabel, { color: C.textPrimary }]}>{s.label}</Text>
                      <Text style={[styles.settingSub, { color: C.textMuted }]}>{s.sub}</Text>
                    </View>
                    <Text style={[styles.chevron, { color: C.textMuted }]}>›</Text>
                  </TouchableOpacity>
                  {i < arr.length - 1 && <View style={[styles.divider, { backgroundColor: C.border }]} />}
                </View>
              ))}
            </View>
          </View>

          <GradientButton
            label={loggingOut ? 'Signing out...' : 'Sign Out'}
            onPress={handleLogout}
            variant="outline"
            disabled={loggingOut}
            style={{ marginTop: 4 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function useStyles(C: ReturnType<typeof useColors>) {
  return useMemo(() => StyleSheet.create({
    root:        { flex: 1, backgroundColor: C.background },
    hero:        { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 28, gap: 6 },
    avatarRing:  { width: 84, height: 84, borderRadius: 42, padding: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    avatarInner: { flex: 1, width: '100%', borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
    avatarText:  { fontFamily: Fonts.bold, fontSize: 28 },
    name:        { fontFamily: Fonts.bold, fontSize: 22 },
    role:        { fontFamily: Fonts.regular, fontSize: 14 },
    kycPill:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6, borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
    kycDot:      { width: 6, height: 6, borderRadius: 3 },
    kycText:     { fontFamily: Fonts.semiBold, fontSize: 12 },
    body:        { paddingHorizontal: 20, gap: 20 },
    statsRow:    { flexDirection: 'row', borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
    statCell:    { flex: 1, alignItems: 'center', paddingVertical: 18, gap: 3 },
    statNum:     { fontFamily: Fonts.bold, fontSize: 24 },
    statLabel:   { fontFamily: Fonts.regular, fontSize: 12 },
    section:     { gap: 10 },
    sectionTitle:{ fontFamily: Fonts.semiBold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 4 },
    card:        { borderRadius: Radius.xl, borderWidth: 1, overflow: 'hidden' },
    infoRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    infoLabel:   { fontFamily: Fonts.medium, fontSize: 13, width: 64 },
    infoValue:   { fontFamily: Fonts.regular, fontSize: 13, flex: 1, textAlign: 'right' },
    settingRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    settingLabel:{ fontFamily: Fonts.medium, fontSize: 14, marginBottom: 2 },
    settingSub:  { fontFamily: Fonts.regular, fontSize: 11 },
    chevron:     { fontSize: 20, fontFamily: Fonts.light },
    divider:     { height: 1, marginHorizontal: 16 },
  }), [C]);
}
