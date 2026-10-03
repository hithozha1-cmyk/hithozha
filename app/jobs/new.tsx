import { Redirect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { CompanyLogo } from '@/components/CompanyLogo';
import { Input } from '@/components/Input';
import { RadioCard } from '@/components/RadioCard';
import { Screen } from '@/components/Screen';
import { Select } from '@/components/Select';
import { useCategories } from '@/hooks/useCategories';
import { CITY_KEYS } from '@/lib/cities';
import {
  HOURS_OPTIONS,
  JOB_TYPES,
  MAX_BUDGET_RUPEES,
  MIN_BUDGET_RUPEES,
  WORK_MODES,
  isRecurring,
  type JobType,
  type WorkMode,
} from '@/lib/jobs';
import { toPaise } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { isClientRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, type } from '@/theme';

type Errors = Partial<Record<'title' | 'category' | 'description' | 'hours' | 'budget' | 'city', string>>;

const digits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 8);

export default function PostJobScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session, profile, company } = useAuth();
  const { categories } = useCategories();

  const [jobType, setJobType] = useState<JobType>('one_time');
  const [hours, setHours] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode>('online');
  const [city, setCity] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const postingAsCompany = profile?.client_type === 'company' ? company : null;

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.slug, label: i18n.language === 'ta' ? c.name_ta : c.name_en })),
    [categories, i18n.language],
  );
  const hoursOptions = useMemo(
    () => HOURS_OPTIONS.map((count) => ({ value: String(count), label: t('jobs.post.hoursOption', { count }) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );
  const cityOptions = useMemo(
    () => CITY_KEYS.map((key) => ({ value: key, label: t(`cities.${key}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Only clients can post. Anyone else who lands here (e.g. a deep link) is sent back.
  if (!isClientRole(profile?.role ?? null)) return <Redirect href="/" />;

  const submit = async () => {
    const next: Errors = {};
    const e = 'jobs.post.errors';
    if (title.trim().length < 5 || title.trim().length > 100) next.title = t(`${e}.title`);
    if (!category) next.category = t(`${e}.category`);
    if (description.trim().length < 20) next.description = t(`${e}.description`);
    if (jobType === 'part_time' && !hours) next.hours = t(`${e}.hours`);
    if (workMode === 'in_person' && !city) next.city = t(`${e}.city`);

    const min = Number(minBudget);
    const max = Number(maxBudget);
    if (!(min >= MIN_BUDGET_RUPEES) || !(max >= MIN_BUDGET_RUPEES) || max > MAX_BUDGET_RUPEES) {
      next.budget = t(`${e}.budget`);
    } else if (max < min) {
      next.budget = t(`${e}.budgetRange`);
    }

    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0 || !session || !category) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        client_id: session.user.id,
        company_id: postingAsCompany?.id ?? null,
        title: title.trim(),
        description: description.trim(),
        category_slug: category,
        job_type: jobType,
        hours_per_week: jobType === 'part_time' ? Number(hours) : null,
        budget_min_paise: toPaise(min),
        budget_max_paise: toPaise(max),
        work_mode: workMode,
        city: workMode === 'in_person' ? city : null,
      })
      .select('id')
      .single();
    setSaving(false);

    if (error || !data) {
      setFormError(t(`${e}.failed`));
      return;
    }
    router.replace({ pathname: '/jobs/[id]', params: { id: data.id } });
  };

  return (
    <Screen footer={<Button title={t('jobs.post.submit')} onPress={() => void submit()} loading={saving} />}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title}>{t('jobs.post.title')}</Text>

      {postingAsCompany ? (
        <View style={styles.postingAs}>
          <CompanyLogo name={postingAsCompany.name} uri={postingAsCompany.logo_url} size={36} />
          <Text style={styles.postingAsText}>{t('jobs.post.postingAs', { name: postingAsCompany.name })}</Text>
        </View>
      ) : null}

      <View style={styles.form}>
        <View style={styles.group}>
          <Text style={styles.sectionLabel}>{t('jobs.post.jobType')}</Text>
          <View style={styles.cards} accessibilityRole="radiogroup">
            {JOB_TYPES.map((value) => (
              <RadioCard
                key={value}
                title={t(`jobs.types.${value}`)}
                description={t(`jobs.typeDescriptions.${value}`)}
                selected={jobType === value}
                onPress={() => setJobType(value)}
              />
            ))}
          </View>
        </View>

        {jobType === 'part_time' ? (
          <Select
            label={t('jobs.post.hours')}
            placeholder={t('jobs.post.hoursPlaceholder')}
            value={hours}
            options={hoursOptions}
            onChange={setHours}
            error={errors.hours}
          />
        ) : null}

        <Input
          label={t('jobs.post.jobTitle')}
          placeholder={t('jobs.post.jobTitlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          error={errors.title}
          maxLength={100}
        />
        <Select
          label={t('jobs.post.category')}
          placeholder={t('jobs.post.categoryPlaceholder')}
          value={category}
          options={categoryOptions}
          onChange={setCategory}
          error={errors.category}
        />
        <Input
          label={t('jobs.post.description')}
          placeholder={t('jobs.post.descriptionPlaceholder')}
          value={description}
          onChangeText={setDescription}
          error={errors.description}
          multiline
          maxLength={2000}
        />

        <View style={styles.group}>
          <Text style={styles.sectionLabel}>{isRecurring(jobType) ? t('jobs.post.budgetMonthly') : t('jobs.post.budgetOneTime')}</Text>
          <View style={styles.budgetRow}>
            <View style={styles.budgetCell}>
              <Input
                accessibilityLabel={t('jobs.post.budgetMin')}
                placeholder={t('jobs.post.budgetMin')}
                value={minBudget}
                onChangeText={(value) => setMinBudget(digits(value))}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.budgetCell}>
              <Input
                accessibilityLabel={t('jobs.post.budgetMax')}
                placeholder={t('jobs.post.budgetMax')}
                value={maxBudget}
                onChangeText={(value) => setMaxBudget(digits(value))}
                keyboardType="number-pad"
              />
            </View>
          </View>
          {errors.budget ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {errors.budget}
            </Text>
          ) : null}
        </View>

        <View style={styles.group}>
          <Text style={styles.sectionLabel}>{t('jobs.post.workMode')}</Text>
          <View style={styles.modeRow} accessibilityRole="radiogroup">
            {WORK_MODES.map((value) => (
              <View key={value} style={styles.modeCell}>
                <RadioCard title={t(`jobs.modes.${value}`)} selected={workMode === value} onPress={() => setWorkMode(value)} />
              </View>
            ))}
          </View>
        </View>

        {workMode === 'in_person' ? (
          <Select
            label={t('jobs.post.city')}
            placeholder={t('jobs.post.cityPlaceholder')}
            value={city}
            options={cityOptions}
            onChange={setCity}
            error={errors.city}
          />
        ) : null}

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
  title: { ...type.title, color: colors.text, paddingTop: 12, paddingBottom: 14 },
  postingAs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 14,
    borderRadius: radius.card,
    backgroundColor: colors.tintBlue,
  },
  postingAsText: { ...type.label, color: colors.accent, flex: 1 },
  form: { gap: 20 },
  group: { gap: 10 },
  cards: { gap: 10 },
  sectionLabel: { ...type.label, color: colors.text },
  budgetRow: { flexDirection: 'row', gap: 10 },
  budgetCell: { flex: 1 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeCell: { flex: 1 },
  error: { ...type.small, color: colors.danger },
});
