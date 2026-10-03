import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '@/theme';

type Props = {
  children: ReactNode;
  variant?: 'default' | 'hero';
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, variant = 'default', style }: Props) {
  return <View style={[styles.base, variant === 'hero' && styles.hero, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  hero: {
    backgroundColor: colors.night,
    borderColor: colors.night,
    borderRadius: radius.hero,
    padding: 20,
  },
});
