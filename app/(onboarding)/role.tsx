import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { ProgressSteps } from '@/components/ProgressSteps';
import { RadioCard } from '@/components/RadioCard';
import { Screen } from '@/components/Screen';
import { isClientRole, type Role } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { useOnboardingProgress } from '@/providers/OnboardingDraft';
import { colors, type } from '@/theme';

const ROLES: Role[] = ['client', 'freelancer', 'both'];

export default function RoleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, updateProfile } = useAuth();
  const [role, setRole] = useState<Role>(profile?.role ?? 'client');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = useOnboardingProgress('role', role);

  const next = async () => {
    setError(null);
    setSaving(true);
    // Freelancers never carry a client type (enforced by a database constraint).
    const saved = await updateProfile(isClientRole(role) ? { role } : { role, client_type: null });
    setSaving(false);
    if (saved) {
      router.push(isClientRole(role) ? '/client-type' : '/profile');
    } else {
      setError(t('common.genericError'));
    }
  };

  return (
    <Screen footer={<Button title={t('common.continue')} onPress={() => void next()} loading={saving} />}>
      <ProgressSteps current={progress.current} total={progress.total} />

      <View style={styles.header}>
        <Text style={styles.title}>{t('onboarding.role.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.role.subtitle')}</Text>
      </View>

      <View style={styles.options} accessibilityRole="radiogroup">
        {ROLES.map((value) => (
          <RadioCard
            key={value}
            title={t(`onboarding.role.${value}`)}
            description={t(`onboarding.role.${value}Description`)}
            selected={role === value}
            onPress={() => setRole(value)}
          />
        ))}
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 10, paddingTop: 24, paddingBottom: 20 },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.muted },
  options: { gap: 14 },
  error: { ...type.small, color: colors.danger, marginTop: 14 },
});
