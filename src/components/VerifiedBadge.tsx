import { ShieldCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radius, type } from '@/theme';

export function VerifiedBadge() {
  const { t } = useTranslation();

  return (
    <View style={styles.badge} accessible accessibilityLabel={t('company.verifiedBadge')}>
      <ShieldCheck size={14} color={colors.success} strokeWidth={2.2} />
      <Text style={styles.text}>{t('company.verifiedBadge')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
  },
  text: { ...type.caption, color: colors.success },
});
