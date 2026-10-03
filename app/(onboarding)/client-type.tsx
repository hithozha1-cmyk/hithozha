import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { ProgressSteps } from '@/components/ProgressSteps';
import { RadioCard } from '@/components/RadioCard';
import { Screen } from '@/components/Screen';
import type { ClientType } from '@/lib/types';
import { useOnboardingDraft, useOnboardingProgress } from '@/providers/OnboardingDraft';
import { colors, type } from '@/theme';

const TYPES: ClientType[] = ['individual', 'company'];

export default function ClientTypeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { clientType, setClientType } = useOnboardingDraft();
  const [selected, setSelected] = useState<ClientType>(clientType ?? 'individual');
  const progress = useOnboardingProgress('client-type');

  const next = () => {
    setClientType(selected);
    router.push(selected === 'company' ? '/company-profile' : '/profile');
  };

  return (
    <Screen footer={<Button title={t('common.continue')} onPress={next} />}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <ProgressSteps current={progress.current} total={progress.total} />

      <View style={styles.header}>
        <Text style={styles.title}>{t('onboarding.clientType.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.clientType.subtitle')}</Text>
      </View>

      <View style={styles.options} accessibilityRole="radiogroup">
        {TYPES.map((value) => (
          <RadioCard
            key={value}
            title={t(`onboarding.clientType.${value}`)}
            description={t(`onboarding.clientType.${value}Description`)}
            selected={selected === value}
            onPress={() => setSelected(value)}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: 10, paddingTop: 20, paddingBottom: 20 },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.muted },
  options: { gap: 14 },
});
