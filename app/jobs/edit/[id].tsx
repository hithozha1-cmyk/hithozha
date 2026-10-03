import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { MAX_BUDGET_RUPEES, MIN_BUDGET_RUPEES, fetchJob, type Job } from '@/lib/jobs';
import { toPaise } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

type Errors = Partial<Record<'title' | 'description' | 'budget', string>>;
const digits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 8);

/** Fix the title, description or budget of a job. Category, type and place stay fixed. */
export default function EditJobScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchJob(id).then((found) => {
      if (!active) return;
      if (found) {
        setTitle(found.title);
        setDescription(found.description);
        setMin(String(Math.round(found.budget_min_paise / 100)));
        setMax(String(Math.round(found.budget_max_paise / 100)));
      }
      setJob(found);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!loading && (!job || job.client_id !== session?.user.id)) return <Redirect href="/" />;

  const save = async () => {
    const next: Errors = {};
    if (title.trim().length < 5) next.title = t('jobs.post.errors.title');
    if (description.trim().length < 20) next.description = t('jobs.post.errors.description');
    const low = Number(min);
    const high = Number(max);
    if (!(low >= MIN_BUDGET_RUPEES) || !(high >= MIN_BUDGET_RUPEES) || high > MAX_BUDGET_RUPEES) next.budget = t('jobs.post.errors.budget');
    else if (high < low) next.budget = t('jobs.post.errors.budgetRange');
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('jobs')
      .update({ title: title.trim(), description: description.trim(), budget_min_paise: toPaise(low), budget_max_paise: toPaise(high) })
      .eq('id', id)
      .select('id');
    setSaving(false);
    // No row back means the rules blocked it: the job already has an order.
    if (error) setFormError(t('editJob.failed'));
    else if (!data || data.length === 0) setFormError(t('editJob.locked'));
    else goBack();
  };

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title={t('account.save')} onPress={() => void save()} loading={saving} />}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title}>{t('editJob.title')}</Text>
      <Text style={styles.note}>{t('editJob.note')}</Text>

      <View style={styles.form}>
        <Input label={t('jobs.post.jobTitle')} value={title} onChangeText={setTitle} error={errors.title} maxLength={100} />
        <Input label={t('jobs.post.description')} value={description} onChangeText={setDescription} error={errors.description} multiline maxLength={2000} />
        <View style={styles.budgetRow}>
          <View style={styles.cell}>
            <Input label={t('jobs.post.budgetMin')} value={min} onChangeText={(v) => setMin(digits(v))} keyboardType="number-pad" />
          </View>
          <View style={styles.cell}>
            <Input label={t('jobs.post.budgetMax')} value={max} onChangeText={(v) => setMax(digits(v))} keyboardType="number-pad" />
          </View>
        </View>
        {errors.budget ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {errors.budget}
          </Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 12 },
  note: { ...type.small, color: colors.muted, paddingBottom: 18, paddingTop: 6 },
  form: { gap: 18 },
  budgetRow: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1 },
  error: { ...type.small, color: colors.danger },
});
