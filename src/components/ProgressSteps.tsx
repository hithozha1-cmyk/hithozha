import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, type } from '@/theme';

type Props = {
  current: number;
  total: number;
};

export function ProgressSteps({ current, total }: Props) {
  const { t } = useTranslation();

  return (
    <View style={styles.wrapper} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: current }}>
      <Text style={styles.label}>{t('onboarding.step', { current, total })}</Text>
      <View style={styles.bars}>
        {Array.from({ length: total }, (_, index) => (
          <View key={index} style={[styles.bar, index < current && styles.barDone]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 10 },
  label: { ...type.label, color: colors.muted },
  bars: { flexDirection: 'row', gap: 6 },
  bar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#DCDCE6' },
  barDone: { backgroundColor: colors.primary },
});
