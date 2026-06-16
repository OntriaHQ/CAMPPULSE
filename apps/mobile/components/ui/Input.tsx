import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useColors } from '@/context/ThemeContext';
import { Fonts, Radius, Spacing } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  rightElement?: React.ReactNode;
}

export function Input({ label, error, containerStyle, rightElement, secureTextEntry, style, ...props }: InputProps) {
  const C = useColors();
  const [hidden, setHidden] = useState(secureTextEntry ?? false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && <Text style={[styles.label, { color: C.textSecondary }]}>{label}</Text>}
      <View style={[
        styles.inputRow,
        { backgroundColor: C.surface, borderColor: C.border },
        focused && { borderColor: C.accent },
        !!error && { borderColor: C.error },
      ]}>
        <TextInput
          {...props}
          secureTextEntry={hidden}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          style={[styles.input, { color: C.textPrimary }, style]}
          placeholderTextColor={C.textMuted}
          selectionColor={C.accent}
          cursorColor={C.accent}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setHidden((v) => !v)} style={styles.toggle}>
            <Text style={[styles.toggleText, { color: C.accent }]}>{hidden ? 'Show' : 'Hide'}</Text>
          </TouchableOpacity>
        )}
        {!secureTextEntry && rightElement && (
          <View style={styles.rightElement}>{rightElement}</View>
        )}
      </View>
      {error && <Text style={[styles.error, { color: C.error }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.xs },
  label: { fontFamily: Fonts.medium, fontSize: 13, marginBottom: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  input: { flex: 1, height: 52, fontFamily: Fonts.regular, fontSize: 15 },
  toggle: { paddingLeft: Spacing.sm, paddingVertical: Spacing.sm },
  toggleText: { fontFamily: Fonts.medium, fontSize: 13 },
  rightElement: { paddingLeft: Spacing.sm },
  error: { fontFamily: Fonts.regular, fontSize: 12, marginTop: 2 },
});
