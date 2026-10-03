import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronLeft, Plus, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { ChipGroup } from '@/components/ChipGroup';
import { Input } from '@/components/Input';
import { ProgressSteps } from '@/components/ProgressSteps';
import { RadioCard } from '@/components/RadioCard';
import { Screen } from '@/components/Screen';
import { Select } from '@/components/Select';
import { useCategories } from '@/hooks/useCategories';
import {
  AVAILABILITY_OPTIONS,
  EXPERIENCE_LEVELS,
  LANGUAGE_KEYS,
  MAX_PORTFOLIO_IMAGES,
  MIN_BIO_LENGTH,
  MIN_STARTING_PRICE_RUPEES,
  type Availability,
  type ExperienceLevel,
} from '@/lib/professional';
import { toPaise } from '@/lib/money';
import { completeOnboarding } from '@/lib/onboarding';
import { pickAndUploadImage } from '@/lib/upload';
import { useAuth } from '@/providers/AuthProvider';
import { useOnboardingDraft, useOnboardingProgress } from '@/providers/OnboardingDraft';
import { colors, radius, type } from '@/theme';

type FieldErrors = {
  headline?: string;
  skills?: string;
  experience?: string;
  languages?: string;
  availability?: string;
  price?: string;
  bio?: string;
};

export default function ProfessionalScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session, profile, refreshProfile } = useAuth();
  const { name, city, avatarUrl, clientType, company } = useOnboardingDraft();
  const progress = useOnboardingProgress('professional');
  const { categories } = useCategories();

  const [headline, setHeadline] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [languages, setLanguages] = useState<string[]>(['ta']);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [price, setPrice] = useState('');
  const [bio, setBio] = useState('');
  const [education, setEducation] = useState('');
  const [portfolio, setPortfolio] = useState<string[]>([]);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const addPortfolioImage = async () => {
    setFormError(null);
    setUploading(true);
    const result = await pickAndUploadImage('portfolio');
    setUploading(false);
    if (result.status === 'ok') setPortfolio((current) => [...current, result.url]);
    if (result.status === 'denied') setFormError(t('onboarding.profile.photoPermission'));
    if (result.status === 'error') setFormError(t('onboarding.profile.photoFailed'));
  };

  const finish = async () => {
    const next: FieldErrors = {};
    const p = 'onboarding.professional';
    if (headline.trim().length < 3) next.headline = t(`${p}.headlineRequired`);
    if (skills.length === 0) next.skills = t(`${p}.skillsRequired`);
    if (!experience) next.experience = t(`${p}.experienceRequired`);
    if (languages.length === 0) next.languages = t(`${p}.languagesRequired`);
    if (!availability) next.availability = t(`${p}.availabilityRequired`);
    if (bio.trim().length < MIN_BIO_LENGTH) next.bio = t(`${p}.bioRequired`);

    let startingPricePaise: number | null = null;
    if (price.trim() !== '') {
      const rupees = Number(price);
      if (!Number.isFinite(rupees) || rupees < MIN_STARTING_PRICE_RUPEES) {
        next.price = t(`${p}.priceInvalid`);
      } else {
        startingPricePaise = toPaise(rupees);
      }
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || !session) return;

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
      freelancer: {
        headline: headline.trim(),
        skills,
        experience_level: experience as string,
        languages,
        availability: availability as string,
        starting_price_paise: startingPricePaise,
        bio: bio.trim(),
        education: education.trim() || null,
        portfolio_urls: portfolio,
      },
    });
    if (!saved) {
      setSaving(false);
      setFormError(t('onboarding.profile.saveFailed'));
      return;
    }
    await refreshProfile();
  };

  const fieldError = (message?: string) =>
    message ? (
      <Text accessibilityRole="alert" style={styles.error}>
        {message}
      </Text>
    ) : null;

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

      <View style={styles.form}>
        <Input
          label={t('onboarding.professional.headline')}
          placeholder={t('onboarding.professional.headlinePlaceholder')}
          value={headline}
          onChangeText={setHeadline}
          error={errors.headline}
          maxLength={80}
        />

        <View style={styles.group}>
          <Text style={styles.sectionLabel}>{t('onboarding.professional.skills')}</Text>
          <Text style={styles.hint}>{t('onboarding.professional.skillsHint')}</Text>
          <ChipGroup options={skillOptions} selected={skills} onChange={setSkills} />
          {fieldError(errors.skills)}
        </View>

        <View style={styles.group}>
          <Text style={styles.sectionLabel}>{t('onboarding.professional.experience')}</Text>
          <View style={styles.cards} accessibilityRole="radiogroup">
            {EXPERIENCE_LEVELS.map((level) => (
              <RadioCard
                key={level}
                title={t(`onboarding.professional.levels.${level}`)}
                description={t(`onboarding.professional.levels.${level}Description`)}
                selected={experience === level}
                onPress={() => setExperience(level)}
              />
            ))}
          </View>
          {fieldError(errors.experience)}
        </View>

        <View style={styles.group}>
          <Text style={styles.sectionLabel}>{t('onboarding.professional.languages')}</Text>
          <ChipGroup options={languageOptions} selected={languages} onChange={setLanguages} />
          {fieldError(errors.languages)}
        </View>

        <Select
          label={t('onboarding.professional.availability')}
          placeholder={t('common.select')}
          value={availability}
          options={availabilityOptions}
          onChange={(value) => setAvailability(value as Availability)}
          error={errors.availability}
        />

        <View style={styles.group}>
          <Input
            label={t('onboarding.professional.startingPrice')}
            placeholder="500"
            value={price}
            onChangeText={(value) => setPrice(value.replace(/[^0-9]/g, '').slice(0, 7))}
            error={errors.price}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>{t('onboarding.professional.startingPriceHint')}</Text>
        </View>

        <Input
          label={t('onboarding.professional.bio')}
          placeholder={t('onboarding.professional.bioPlaceholder')}
          value={bio}
          onChangeText={setBio}
          error={errors.bio}
          multiline
          maxLength={500}
        />

        <Input
          label={t('onboarding.professional.education')}
          placeholder={t('onboarding.professional.educationPlaceholder')}
          value={education}
          onChangeText={setEducation}
          maxLength={200}
        />

        <View style={styles.group}>
          <Text style={styles.sectionLabel}>{t('onboarding.professional.portfolio')}</Text>
          <Text style={styles.hint}>{t('onboarding.professional.portfolioHint', { count: MAX_PORTFOLIO_IMAGES })}</Text>
          <View style={styles.grid}>
            {portfolio.map((url) => (
              <View key={url} style={styles.thumbWrap}>
                <Image source={{ uri: url }} style={styles.thumb} contentFit="cover" />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('onboarding.professional.removeImage')}
                  hitSlop={8}
                  onPress={() => setPortfolio((current) => current.filter((item) => item !== url))}
                  style={styles.remove}
                >
                  <X size={16} color={colors.onDark} strokeWidth={2.4} />
                </Pressable>
              </View>
            ))}
            {portfolio.length < MAX_PORTFOLIO_IMAGES ? (
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
        </View>

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
  header: { gap: 8, paddingTop: 20, paddingBottom: 18 },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.muted },
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
