import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useColors } from '@/context/ThemeContext';
import { Fonts, GradientColors, GradientEnd, GradientStart, Radius, Shadow } from '@/constants/theme';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  variant?: 'primary' | 'outline' | 'ghost';
}

export function GradientButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  style,
  variant = 'primary',
}: GradientButtonProps) {
  const C = useColors();
  const isDisabled = disabled || loading;

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.outline, { borderColor: C.error }, isDisabled && styles.disabled, style]}
        activeOpacity={0.75}
      >
        <Text style={[styles.outlineLabel, { color: C.error }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'ghost') {
    return (
      <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={0.7} style={style}>
        <Text style={[styles.ghostLabel, { color: C.accent }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={0.85} style={[isDisabled && styles.disabled, style]}>
      <LinearGradient colors={GradientColors} start={GradientStart} end={GradientEnd} style={[styles.gradient, Shadow.glow]}>
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.label}>{label}</Text>
        }
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  gradient: { height: 54, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  label:    { fontFamily: Fonts.semiBold, fontSize: 15, color: '#fff', letterSpacing: 0.3 },
  outline:  { height: 54, borderRadius: Radius.full, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  outlineLabel: { fontFamily: Fonts.semiBold, fontSize: 15, letterSpacing: 0.3 },
  ghostLabel:   { fontFamily: Fonts.medium, fontSize: 14, letterSpacing: 0.2 },
  disabled:     { opacity: 0.45 },
});
