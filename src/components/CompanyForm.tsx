import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { CompanyLogo } from '@/components/CompanyLogo';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { CITY_KEYS } from '@/lib/cities';
import { INDUSTRIES, TEAM_SIZES, type CompanyField, type CompanyFormValues, type TeamSize } from '@/lib/company';
import { pickAndUploadImage } from '@/lib/upload';
import { colors, type } from '@/theme';

type Props = {
  values: CompanyFormValues;
  onChange: (values: CompanyFormValues) => void;
  /** i18n keys, from validateCompany(). */
  errors: Partial<Record<CompanyField, string>>;
};

/** The company fields shared by onboarding and the Edit company screen. */
export function CompanyForm({ values, onChange, errors }: Props) {
  const { t, i18n } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const teamSizeOptions = useMemo(
    () => TEAM_SIZES.map((size) => ({ value: size, label: t(`company.teamSizes.${size}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );
  const industryOptions = useMemo(
    () => INDUSTRIES.map((key) => ({ value: key, label: t(`company.industries.${key}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );
  const cityOptions = useMemo(
    () => CITY_KEYS.map((key) => ({ value: key, label: t(`cities.${key}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  const set = <K extends keyof CompanyFormValues>(key: K, value: CompanyFormValues[K]) =>
    onChange({ ...values, [key]: value });
  const message = (field: CompanyField) => (errors[field] ? t(errors[field]) : undefined);

  const chooseLogo = async () => {
    setLogoError(null);
    setUploading(true);
    const result = await pickAndUploadImage('company_logo');
    setUploading(false);
    if (result.status === 'ok') set('logoUrl', result.url);
    if (result.status === 'denied') setLogoError(t('onboarding.profile.photoPermission'));
    if (result.status === 'error') setLogoError(t('company.errors.logoFailed'));
  };

  return (
    <View style={styles.form}>
      <View style={styles.logoRow}>
        <CompanyLogo name={values.name} uri={values.logoUrl} size={84} />
        <View style={styles.logoText}>
          <Text style={styles.label}>{t('company.form.logo')}</Text>
          <Button
            variant="outline"
            title={uploading ? t('company.form.uploading') : values.logoUrl ? t('company.form.changeLogo') : t('company.form.addLogo')}
            onPress={() => void chooseLogo()}
            loading={uploading}
            style={styles.logoButton}
          />
        </View>
      </View>
      {logoError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {logoError}
        </Text>
      ) : null}

      <Input
        label={t('company.form.name')}
        placeholder={t('company.form.namePlaceholder')}
        value={values.name}
        onChangeText={(value) => set('name', value)}
        error={message('name')}
        maxLength={80}
      />
      <Input
        label={t('company.form.website')}
        placeholder={t('company.form.websitePlaceholder')}
        value={values.website}
        onChangeText={(value) => set('website', value)}
        error={message('website')}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={200}
      />
      <Input
        label={t('company.form.linkedin')}
        placeholder={t('company.form.linkedinPlaceholder')}
        value={values.linkedin}
        onChangeText={(value) => set('linkedin', value)}
        error={message('linkedin')}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={200}
      />
      <Select
        label={t('company.form.teamSize')}
        placeholder={t('company.form.teamSizePlaceholder')}
        value={values.teamSize}
        options={teamSizeOptions}
        onChange={(value) => set('teamSize', value as TeamSize)}
        error={message('teamSize')}
      />
      <Select
        label={t('company.form.industry')}
        placeholder={t('company.form.industryPlaceholder')}
        value={values.industry}
        options={industryOptions}
        onChange={(value) => set('industry', value)}
        error={message('industry')}
      />
      <Select
        label={t('company.form.city')}
        placeholder={t('company.form.cityPlaceholder')}
        value={values.city}
        options={cityOptions}
        onChange={(value) => set('city', value)}
        error={message('city')}
      />
      <Input
        label={t('company.form.about')}
        placeholder={t('company.form.aboutPlaceholder')}
        value={values.about}
        onChangeText={(value) => set('about', value)}
        multiline
        maxLength={600}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoText: { flex: 1, gap: 8 },
  label: { ...type.label, color: colors.text },
  logoButton: { minHeight: 44 },
  error: { ...type.small, color: colors.danger },
});
