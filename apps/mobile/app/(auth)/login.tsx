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
import { Fonts, GradientColors, Spacing } from '@/constants/theme';
import { useColors } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const C = useColors();
  const styles = useStyles(C);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)/map');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['rgba(0,200,150,0.12)', 'transparent']} style={styles.topGlow} pointerEvents="none" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoRow}>
            <LinearGradient colors={GradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoMark}>
              <Text style={styles.logoMarkText}>CP</Text>
            </LinearGradient>
            <Text style={styles.logoName}>CampPulse</Text>
          </View>

          <View style={styles.headingBlock}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>Sign in to continue</Text>
          </View>

          <View style={styles.form}>
            <Input label="Email address" placeholder="you@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" />
            <Input label="Password" placeholder="Min. 8 characters" value={password} onChangeText={setPassword} secureTextEntry returnKeyType="done" onSubmitEditing={handleLogin} />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TouchableOpacity style={styles.forgotRow} onPress={() => {}}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
            <GradientButton label="Sign In" onPress={handleLogin} loading={loading} style={styles.cta} />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.footerLink}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function useStyles(C: ReturnType<typeof useColors>) {
  return useMemo(() => StyleSheet.create({
    container:   { flex: 1, backgroundColor: C.background },
    topGlow:     { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
    scroll:      { flexGrow: 1, paddingHorizontal: Spacing.lg },
    logoRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.xxl },
    logoMark:    { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    logoMarkText:{ fontFamily: Fonts.bold, fontSize: 16, color: '#fff', letterSpacing: 0.5 },
    logoName:    { fontFamily: Fonts.semiBold, fontSize: 18, color: C.textPrimary, letterSpacing: 0.3 },
    headingBlock:{ marginBottom: Spacing.xl },
    heading:     { fontFamily: Fonts.bold, fontSize: 28, lineHeight: 36, color: C.textPrimary, marginBottom: 6 },
    subheading:  { fontFamily: Fonts.regular, fontSize: 13, lineHeight: 20, color: C.textSecondary },
    form:        { gap: Spacing.md },
    forgotRow:   { alignSelf: 'flex-end', marginTop: -4 },
    forgotText:  { fontFamily: Fonts.medium, fontSize: 13, color: C.accent },
    cta:         { marginTop: Spacing.sm },
    errorText:   { fontFamily: Fonts.regular, fontSize: 13, color: C.error, textAlign: 'center' },
    footer:      { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xxl },
    footerText:  { fontFamily: Fonts.regular, fontSize: 14, color: C.textSecondary },
    footerLink:  { fontFamily: Fonts.semiBold, fontSize: 14, color: C.accent },
  }), [C]);
}
