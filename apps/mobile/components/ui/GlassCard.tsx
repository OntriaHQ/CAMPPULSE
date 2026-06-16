import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Radius } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  padding?: number;
  borderRadius?: number;
}

export function GlassCard({
  children,
  style,
  intensity = 40,
  padding = 16,
  borderRadius = Radius.xl,
}: GlassCardProps) {
  const { isDark, colors } = useTheme();

  if (Platform.OS === 'android') {
    return (
      <View
        style={[
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            padding,
            borderRadius,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={isDark ? 'dark' : 'light'}
      style={[styles.blur, { padding, borderRadius, borderColor: colors.glass.border }, style]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass.background, borderRadius }]} />
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  blur: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
