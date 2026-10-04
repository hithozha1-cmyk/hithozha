import { Image } from 'expo-image';
import { Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ChipGroup } from '@/components/ChipGroup';
import { Input } from '@/components/Input';
import { RadioCard } from '@/components/RadioCard';
import { Select } from '@/components/Select';
import { useCategories } from '@/hooks/useCategories';
import type { FreelancerField, FreelancerFormValues } from '@/lib/freelancerForm';
import {
  AVAILABILITY_OPTIONS,
  EXPERIENCE_LEVELS,
  LANGUAGE_KEYS,
  MAX_PORTFOLIO_IMAGES,
  type Availability,
} from '@/lib/professional';
import { failedWith, pickAndUploadImage } from '@/lib/upload';
import { colors, radius, type } from '@/theme';

type Props = {
  values: FreelancerFormValues;
  onChange: (values: FreelancerFormValues) => void;
  /** i18n keys, from validateFreelancer(). */
  errors: Partial<Record<FreelancerField, string>>;
};

/** The freelancer details shared by onboarding and the edit screen. */
export function FreelancerForm({ values, onChange, errors }: Props) {
  const { t, i18n } = useTranslation();
  const { categories } = useCategories();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const skillOptions = useMemo(
    () => categories.map((c) => ({ value: c.slug, label: i18n.language === 'ta' ? c.name_ta : c.name_en })),
    [categories, i18n.language],
  );
  const languageOptions = useMemo(
    () => LANGUAGE_KEYS.map((key) => ({ value: key, label: t(`onboarding.professional.languageNames.${key}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );
  const availabilityOptions = useMemo(
    () => AVAILABILITY_OPTIONS.map((key) => ({ value: key, label: t(`onboarding.professional.availabilityOptions.${key}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  const set = <K extends keyof FreelancerFormValues>(key: K, value: FreelancerFormValues[K]) => onChange({ ...values, [key]: value });
  const message = (field: FreelancerField) => (errors[field] ? t(errors[field]) : undefined);
  const fieldError = (field: FreelancerField) =>
    errors[field] ? (
      <Text accessibilityRole="alert" style={styles.error}>
        {t(errors[field])}
      </Text>
    ) : null;

  const addPortfolioImage = async () => {
    setUploadError(null);
    setUploading(true);
    const result = await pickAndUploadImage('portfolio');
    setUploading(false);
    if (result.status === 'ok') onChange({ ...values, portfolio: [...values.portfolio, result.url] });
    if (result.status === 'denied') setUploadError(t('onboarding.profile.photoPermission'));
    if (result.status === 'error') setUploadError(failedWith(t('onboarding.profile.photoFailed'), result));
  };

  return (
    <View style={styles.form}>
      <Input
        label={t('onboarding.professional.headline')}
        placeholder={t('onboarding.professional.headlinePlaceholder')}
        value={values.headline}
        onChangeText={(value) => set('headline', value)}
        error={message('headline')}
        maxLength={80}
      />

      <View style={styles.group}>
        <Text style={styles.sectionLabel}>{t('onboarding.professional.skills')}</Text>
        <Text style={styles.hint}>{t('onboarding.professional.skillsHint')}</Text>
        <ChipGroup options={skillOptions} selected={values.skills} onChange={(value) => set('skills', value)} />
        {fieldError('skills')}
      </View>

      <View style={styles.group}>
        <Text style={styles.sectionLabel}>{t('onboarding.professional.experience')}</Text>
        <View style={styles.cards} accessibilityRole="radiogroup">
          {EXPERIENCE_LEVELS.map((level) => (
            <RadioCard
              key={level}
              title={t(`onboarding.professional.levels.${level}`)}
              description={t(`onboarding.professional.levels.${level}Description`)}
              selected={values.experience === level}
              onPress={() => set('experience', level)}
            />
          ))}
        </View>
        {fieldError('experience')}
      </View>

      <View style={styles.group}>
        <Text style={styles.sectionLabel}>{t('onboarding.professional.languages')}</Text>
        <ChipGroup options={languageOptions} selected={values.languages} onChange={(value) => set('languages', value)} />
        {fieldError('languages')}
      </View>

      <Select
        label={t('onboarding.professional.availability')}
        placeholder={t('common.select')}
        value={values.availability}
        options={availabilityOptions}
        onChange={(value) => set('availability', value as Availability)}
        error={message('availability')}
      />

      <View style={styles.group}>
        <Input
          label={t('onboarding.professional.startingPrice')}
          placeholder="500"
          value={values.price}
          onChangeText={(value) => set('price', value.replace(/[^0-9]/g, '').slice(0, 7))}
          error={message('price')}
          keyboardType="number-pad"
        />
        <Text style={styles.hint}>{t('onboarding.professional.startingPriceHint')}</Text>
      </View>

      <Input
        label={t('onboarding.professional.bio')}
        placeholder={t('onboarding.professional.bioPlaceholder')}
        value={values.bio}
        onChangeText={(value) => set('bio', value)}
        error={message('bio')}
        multiline
        maxLength={500}
      />

      <Input
        label={t('onboarding.professional.education')}
        placeholder={t('onboarding.professional.educationPlaceholder')}
        value={values.education}
        onChangeText={(value) => set('education', value)}
        maxLength={200}
      />

      <View style={styles.group}>
        <Input
          label={t('onboarding.professional.website')}
          placeholder="https://yourname.com"
          value={values.website}
          onChangeText={(value) => set('website', value)}
          error={message('website')}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={200}
        />
        <Text style={styles.hint}>{t('onboarding.professional.websiteHint')}</Text>
      </View>

      <View style={styles.group}>
        <Text style={styles.sectionLabel}>{t('onboarding.professional.portfolio')}</Text>
        <Text style={styles.hint}>{t('onboarding.professional.portfolioHint', { count: MAX_PORTFOLIO_IMAGES })}</Text>
        <View style={styles.grid}>
          {values.portfolio.map((url) => (
            <View key={url} style={styles.thumbWrap}>
              <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('onboarding.professional.removeImage')}
                hitSlop={8}
                onPress={() => set('portfolio', values.portfolio.filter((item) => item !== url))}
                style={styles.remove}
              >
                <X size={16} color={colors.onDark} strokeWidth={2.4} />
              </Pressable>
            </View>
          ))}
          {values.portfolio.length < MAX_PORTFOLIO_IMAGES ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.professional.addImage')}
              disabled={uploading}
              onPress={() => void addPortfolioImage()}
              style={[styles.thumb, styles.addTile, uploading && { opacity: 0.55 }]}
            >
              <Plus size={26} color={colors.muted} strokeWidth={1.8} />
            </Pressable>
          ) : null}
        </View>
        {uploadError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {uploadError}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 22 },
  group: { gap: 8 },
  cards: { gap: 10 },
  sectionLabel: { ...type.label, color: colors.text },
  hint: { ...type.small, color: colors.muted },
  error: { ...type.small, color: colors.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumbWrap: { width: 96, height: 96 },
  thumb: { width: 96, height: 96, borderRadius: radius.input, backgroundColor: colors.tintBlue },
  addTile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.inputBorder, backgroundColor: colors.card },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.night,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
