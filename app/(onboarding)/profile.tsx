import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ProgressSteps } from '@/components/ProgressSteps';
import { Screen } from '@/components/Screen';
import { Select } from '@/components/Select';
import { CITY_KEYS } from '@/lib/cities';
import { isFreelancerRole } from '@/lib/types';
import { completeOnboarding } from '@/lib/onboarding';
import { failedWith, pickAndUploadImage } from '@/lib/upload';
import { useAuth } from '@/providers/AuthProvider';
import { useOnboardingDraft, useOnboardingProgress } from '@/providers/OnboardingDraft';
import { colors, type } from '@/theme';

type FieldErrors = { name?: string; city?: string };

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuth();
  const { name, setName, city, setCity, avatarUrl, setAvatarUrl, clientType, company } = useOnboardingDraft();
  const progress = useOnboardingProgress('profile');
  const freelancer = isFreelancerRole(profile?.role ?? null);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const cityOptions = useMemo(
    () => CITY_KEYS.map((key) => ({ value: key, label: t(`cities.${key}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  const choosePhoto = async () => {
    setFormError(null);
    setUploading(true);
    const result = await pickAndUploadImage('avatar');
    setUploading(false);
    if (result.status === 'ok') setAvatarUrl(result.url);
    if (result.status === 'denied') setFormError(t('onboarding.profile.photoPermission'));
    if (result.status === 'error') setFormError(failedWith(t('onboarding.profile.photoFailed'), result));
  };

  const submit = async () => {
    const nextErrors: FieldErrors = {};
    if (name.trim().length < 2) nextErrors.name = t('onboarding.profile.nameRequired');
    if (!city) nextErrors.city = t('onboarding.profile.cityRequired');
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !session) return;

    if (freelancer) {
      router.push('/professional');
      return;
    }

    // Clients are done here. Saving name + city completes onboarding.
    if (!profile?.role || !city) return;
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
      freelancer: null,
    });
    if (!saved) {
      setSaving(false);
      setFormError(t('onboarding.profile.saveFailed'));
      return;
    }
    await refreshProfile();
  };

  return (
    <Screen
      footer={
        <Button
          title={freelancer ? t('common.continue') : t('onboarding.profile.finish')}
          onPress={() => void submit()}
          loading={saving}
        />
      }
    >
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <ProgressSteps current={progress.current} total={progress.total} />

      <Text style={styles.title}>{t('onboarding.profile.title')}</Text>

      <View style={styles.form}>
        <View style={styles.photoRow}>
          <Avatar name={name} uri={avatarUrl} size={84} />
          <View style={styles.photoText}>
            <Text style={styles.photoLabel}>{t('onboarding.profile.photo')}</Text>
            <Button
              variant="outline"
              title={uploading ? t('onboarding.profile.uploading') : avatarUrl ? t('onboarding.profile.changePhoto') : t('onboarding.profile.addPhoto')}
              onPress={() => void choosePhoto()}
              loading={uploading}
              style={styles.photoButton}
            />
          </View>
        </View>

        <Input
          label={t('onboarding.profile.name')}
          placeholder={t('onboarding.profile.namePlaceholder')}
          value={name}
          onChangeText={setName}
          error={errors.name}
          autoComplete="name"
          textContentType="name"
          maxLength={80}
        />
        <Select
          label={t('onboarding.profile.city')}
          placeholder={t('onboarding.profile.cityPlaceholder')}
          value={city}
          options={cityOptions}
          onChange={setCity}
          error={errors.city}
        />

        {formError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {formError}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 20, paddingBottom: 18 },
  form: { gap: 18 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  photoText: { flex: 1, gap: 8 },
  photoLabel: { ...type.label, color: colors.text },
  photoButton: { minHeight: 44 },
  error: { ...type.small, color: colors.danger },
});
