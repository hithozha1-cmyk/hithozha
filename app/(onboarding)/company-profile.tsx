import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { CompanyForm } from '@/components/CompanyForm';
import { ProgressSteps } from '@/components/ProgressSteps';
import { Screen } from '@/components/Screen';
import { validateCompany, type CompanyField } from '@/lib/company';
import { useOnboardingDraft, useOnboardingProgress } from '@/providers/OnboardingDraft';
import { colors, type } from '@/theme';

export default function CompanyProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company, setCompany } = useOnboardingDraft();
  const [errors, setErrors] = useState<Partial<Record<CompanyField, string>>>({});
  const progress = useOnboardingProgress('company-profile');

  const next = () => {
    const found = validateCompany(company);
    setErrors(found);
    if (Object.keys(found).length === 0) router.push('/profile');
  };

  return (
    <Screen footer={<Button title={t('common.continue')} onPress={next} />}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <ProgressSteps current={progress.current} total={progress.total} />

      <View style={styles.header}>
        <Text style={styles.title}>{t('company.onboardingTitle')}</Text>
        <Text style={styles.subtitle}>{t('company.onboardingSubtitle')}</Text>
      </View>

      <CompanyForm values={company} onChange={setCompany} errors={errors} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: 8, paddingTop: 20, paddingBottom: 18 },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.muted },
});
