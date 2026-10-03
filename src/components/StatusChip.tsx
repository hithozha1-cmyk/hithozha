import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, type } from '@/theme';

export type ChipTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

const TONES: Record<ChipTone, { bg: string; fg: string }> = {
  neutral: { bg: '#E8E8EF', fg: colors.muted },
  info: { bg: colors.tintBlue, fg: colors.accent },
  warning: { bg: '#FFF1D6', fg: '#7A4B00' },
  success: { bg: colors.successBg, fg: colors.success },
  danger: { bg: colors.tintRedSoft, fg: colors.danger },
};

export function StatusChip({ label, tone = 'neutral' }: { label: string; tone?: ChipTone }) {
  const scheme = TONES[tone];
  return (
    <View style={[styles.chip, { backgroundColor: scheme.bg }]}>
      <Text style={[styles.text, { color: scheme.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  text: { ...type.caption },
});
