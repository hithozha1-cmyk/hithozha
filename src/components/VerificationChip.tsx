import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { VerificationStatus } from '@/lib/types';
import { colors, radius, type } from '@/theme';

const SCHEME: Record<VerificationStatus, { bg: string; fg: string }> = {
  none: { bg: '#E8E8EF', fg: colors.muted },
  pending: { bg: colors.tintBlue, fg: colors.accent },
  verified: { bg: colors.successBg, fg: colors.success },
  rejected: { bg: colors.tintRedSoft, fg: colors.danger },
};

export function VerificationChip({ status }: { status: VerificationStatus }) {
  const { t } = useTranslation();
  const scheme = SCHEME[status];

  return (
    <View style={[styles.chip, { backgroundColor: scheme.bg }]}>
      <Text style={[styles.text, { color: scheme.fg }]}>{t(`company.status.${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  text: { ...type.caption },
});
