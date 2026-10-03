import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, radius, type } from '@/theme';

type Variant = 'primary' | 'outline' | 'dark';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const palette: Record<Variant, { bg: string; pressed: string; text: string; border: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, text: colors.onDark, border: colors.primary },
  dark: { bg: colors.night, pressed: colors.nightPressed, text: colors.onDark, border: colors.night },
  outline: { bg: colors.card, pressed: colors.background, text: colors.text, border: colors.inputBorder },
};

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, icon, style }: Props) {
  const inactive = disabled || loading;
  const scheme = palette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? scheme.pressed : scheme.bg, borderColor: scheme.border },
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={scheme.text} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[type.button, { color: scheme.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.button,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inactive: { opacity: 0.55 },
});
