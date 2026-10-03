import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Select } from '@/components/Select';
import { CITY_KEYS } from '@/lib/cities';
import { pickAndUploadImage } from '@/lib/upload';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

type FieldErrors = { name?: string; city?: string };

/** Change name, city and photo after onboarding. */
export default function EditProfileScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { profile, updateProfile } = useAuth();

  const [name, setName] = useState(profile?.full_name ?? '');
  const [city, setCity] = useState<string | null>(profile?.city ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const cityOptions = useMemo(
    () => CITY_KEYS.map((key) => ({ value: key, label: t(`cities.${key}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const choosePhoto = async () => {
    setFormError(null);
    setUploading(true);
    const result = await pickAndUploadImage('avatar');
    setUploading(false);
    if (result.status === 'ok') setAvatarUrl(result.url);
    if (result.status === 'denied') setFormError(t('onboarding.profile.photoPermission'));
    if (result.status === 'error') setFormError(t('onboarding.profile.photoFailed'));
  };

  const save = async () => {
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = t('onboarding.profile.nameRequired');
    if (!city) next.city = t('onboarding.profile.cityRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setFormError(null);
    setSaving(true);
    const saved = await updateProfile({ full_name: name.trim(), city, avatar_url: avatarUrl });
    setSaving(false);
    if (!saved) {
      setFormError(t('account.saveFailed'));
      return;
    }
    goBack();
  };

  return (
    <Screen footer={<Button title={t('account.save')} onPress={() => void save()} loading={saving} />}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title}>{t('account.editTitle')}</Text>

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
  title: { ...type.title, color: colors.text, paddingTop: 12, paddingBottom: 18 },
  form: { gap: 18 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  photoText: { flex: 1, gap: 8 },
  photoLabel: { ...type.label, color: colors.text },
  photoButton: { minHeight: 44 },
  error: { ...type.small, color: colors.danger },
});
