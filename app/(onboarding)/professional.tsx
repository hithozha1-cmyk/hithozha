import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { FreelancerForm } from '@/components/FreelancerForm';
import { ProgressSteps } from '@/components/ProgressSteps';
import { Screen } from '@/components/Screen';
import { EMPTY_FREELANCER, validateFreelancer, type FreelancerField, type FreelancerFormValues } from '@/lib/freelancerForm';
import { completeOnboarding } from '@/lib/onboarding';
import { useAuth } from '@/providers/AuthProvider';
import { useOnboardingDraft, useOnboardingProgress } from '@/providers/OnboardingDraft';
import { colors, type } from '@/theme';

export default function ProfessionalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();
  const { name, city, avatarUrl, clientType, company } = useOnboardingDraft();
  const progress = useOnboardingProgress('professional');

  const [values, setValues] = useState<FreelancerFormValues>(EMPTY_FREELANCER);
  const [errors, setErrors] = useState<Partial<Record<FreelancerField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    const result = validateFreelancer(values);
    setErrors(result.errors);
    if (!result.details || !session || !profile?.role || !city) return;

    setFormError(null);
    setSaving(true);
    const saved = await completeOnboarding({
      userId: session.user.id,
      name,
      city,
      avatarUrl,
      role: profile.role,
      clientType,
      company: clientType === 'company' ? company : null,
      freelancer: result.details,
    });
    if (!saved) {
      setSaving(false);
      setFormError(t('onboarding.profile.saveFailed'));
      return;
    }
    await refreshProfile();
  };

  return (
    <Screen footer={<Button title={t('onboarding.professional.finish')} onPress={() => void finish()} loading={saving} />}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <ProgressSteps current={progress.current} total={progress.total} />

      <View style={styles.header}>
        <Text style={styles.title}>{t('onboarding.professional.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.professional.subtitle')}</Text>
      </View>

      <FreelancerForm values={values} onChange={setValues} errors={errors} />

      {formError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {formError}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  header: { gap: 8, paddingTop: 20, paddingBottom: 18 },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.muted },
  error: { ...type.small, color: colors.danger, marginTop: 18 },
});
