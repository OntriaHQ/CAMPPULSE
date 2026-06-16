import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GradientButton } from '@/components/ui/GradientButton';
import { Input } from '@/components/ui/Input';
import { Fonts, GradientColors, Radius, Spacing } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useAuth, type RegisterData } from '@/context/AuthContext';

type Role = 'resident' | 'driver';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const C = useColors();
  const styles = useStyles(C);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('resident');
  const [campId, setCampId] = useState('');
  const [zone, setZone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Full name, email, and password are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data: RegisterData = {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        ...(phone.trim()  && { phone:   phone.trim()  }),
        ...(campId.trim() && { camp_id: campId.trim() }),
        ...(zone.trim()   && { zone:    zone.trim()   }),
      };
      await register(data);
      router.replace('/(tabs)/map');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['rgba(14,165,233,0.10)', 'transparent']} style={styles.topGlow} pointerEvents="none" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.headingBlock}>
            <Text style={styles.heading}>Create Account</Text>
            <Text style={styles.subheading}>Join Redemption City</Text>
          </View>

          <View style={styles.form}>
            <Input label="Full name" placeholder="Adaeze Okonkwo" value={fullName} onChangeText={setFullName} autoCapitalize="words" returnKeyType="next" />
            <Input label="Email address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" />
            <Input label="Phone number" placeholder="+234 800 000 0000" value={phone} onChangeText={setPhone} keyboardType="phone-pad" returnKeyType="next" />
            <Input label="Password" placeholder="Min. 8 characters" value={password} onChangeText={setPassword} secureTextEntry returnKeyType="next" />

            <View style={styles.roleSection}>
              <Text style={styles.roleLabel}>I am a...</Text>
              <View style={styles.roleRow}>
                {(['resident', 'driver'] as Role[]).map((r) => (
                  <TouchableOpacity key={r} onPress={() => setRole(r)} style={styles.rolePillWrapper} activeOpacity={0.8}>
                    {role === r ? (
                      <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rolePill}>
                        <Text style={styles.rolePillTextActive}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.rolePill, { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }]}>
                        <Text style={[styles.rolePillText, { color: C.textSecondary }]}>{r.charAt(0).toUpperCase() + r.slice(1)}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.optionalSection}>
              <Text style={styles.optionalLabel}>Optional</Text>
              <View style={styles.optionalFields}>
                <Input placeholder="Camp ID  e.g. RC-2024-00142" value={campId} onChangeText={setCampId} autoCapitalize="characters" returnKeyType="next" />
                <Input placeholder="Zone  e.g. Zone A" value={zone} onChangeText={setZone} autoCapitalize="words" returnKeyType="done" onSubmitEditing={handleRegister} />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <GradientButton label="Create Account" onPress={handleRegister} loading={loading} style={styles.cta} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.footerLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function useStyles(C: ReturnType<typeof useColors>) {
  return useMemo(() => StyleSheet.create({
    container:       { flex: 1, backgroundColor: C.background },
    topGlow:         { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
    scroll:          { flexGrow: 1, paddingHorizontal: Spacing.lg },
    backBtn:         { marginBottom: Spacing.lg },
    backText:        { fontFamily: Fonts.medium, fontSize: 15, color: C.accent },
    headingBlock:    { marginBottom: Spacing.xl },
    heading:         { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 36, color: C.textPrimary, marginBottom: 6 },
    subheading:      { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 20, color: C.textSecondary },
    form:            { gap: Spacing.md },
    roleSection:     { gap: Spacing.sm },
    roleLabel:       { fontFamily: Fonts.medium, fontSize: 13, color: C.textSecondary },
    roleRow:         { flexDirection: 'row', gap: Spacing.sm },
    rolePillWrapper: { flex: 1 },
    rolePill:        { height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
    rolePillTextActive: { fontFamily: Fonts.semiBold, fontSize: 14, color: '#fff' },
    rolePillText:    { fontFamily: Fonts.medium, fontSize: 14 },
    optionalSection: { gap: Spacing.sm },
    optionalLabel:   { fontFamily: Fonts.medium, fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
    optionalFields:  { gap: Spacing.sm },
    cta:             { marginTop: Spacing.sm },
    errorText:       { fontFamily: Fonts.regular, fontSize: 13, color: C.error, textAlign: 'center' },
    footer:          { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl },
    footerText:      { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary },
    footerLink:      { fontFamily: Fonts.semiBold, fontSize: 14, color: C.accent },
  }), [C]);
}
