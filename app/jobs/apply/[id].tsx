import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { fetchJob, type Job } from '@/lib/jobs';
import { formatINR, toPaise } from '@/lib/money';
import { MIN_PROPOSAL_MESSAGE, MIN_PROPOSAL_RUPEES, PLATFORM_FEE_PERCENT, earningsAfterFee } from '@/lib/proposals';
import { supabase } from '@/lib/supabase';
import { isFreelancerRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, type } from '@/theme';

type Errors = Partial<Record<'message' | 'price' | 'days', string>>;

const digits = (value: string, max: number) => value.replace(/[^0-9]/g, '').slice(0, max);

export default function ApplyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, profile } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [price, setPrice] = useState('');
  const [days, setDays] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchJob(id).then((result) => {
      if (!active) return;
      setJob(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!isFreelancerRole(profile?.role ?? null)) return <Redirect href="/" />;

  const priceRupees = Number(price);
  const earnings = priceRupees >= MIN_PROPOSAL_RUPEES ? earningsAfterFee(toPaise(priceRupees)) : null;

  const submit = async () => {
    const next: Errors = {};
    const e = 'proposals.errors';
    if (message.trim().length < MIN_PROPOSAL_MESSAGE) next.message = t(`${e}.message`);
    if (!(priceRupees >= MIN_PROPOSAL_RUPEES)) next.price = t(`${e}.price`);
    const dayCount = Number(days);
    if (!(dayCount >= 1 && dayCount <= 365)) next.days = t(`${e}.days`);
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0 || !session) return;

    setSaving(true);
    const { error } = await supabase.from('proposals').insert({
      job_id: id,
      message: message.trim(),
      price_paise: toPaise(priceRupees),
      delivery_days: dayCount,
    });
    setSaving(false);

    if (error) {
      setFormError(error.code === '23505' ? t(`${e}.alreadyApplied`) : t(`${e}.failed`));
      return;
    }
    goBack();
  };

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
      <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
    </Pressable>
  );

  if (loading) {
    return (
      <Screen scroll={false}>
        {back}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title={t('proposals.send')} onPress={() => void submit()} loading={saving} />}>
      {back}
      <Text style={styles.title}>{t('proposals.applyTitle')}</Text>
      {job ? (
        <View style={styles.jobBox}>
          <Text style={styles.jobLabel}>{t('proposals.forJob')}</Text>
          <Text style={styles.jobTitle} numberOfLines={2}>
            {job.title}
          </Text>
        </View>
      ) : null}

      <View style={styles.form}>
        <Input
          label={t('proposals.messageLabel')}
          placeholder={t('proposals.messagePlaceholder')}
          value={message}
          onChangeText={setMessage}
          error={errors.message}
          multiline
          maxLength={1000}
        />
        <View style={styles.group}>
          <Input
            label={t('proposals.price')}
            placeholder={t('proposals.pricePlaceholder')}
            value={price}
            onChangeText={(value) => setPrice(digits(value, 8))}
            error={errors.price}
            keyboardType="number-pad"
          />
          <Text style={styles.hint}>
            {earnings !== null
              ? t('proposals.priceHint', { percent: PLATFORM_FEE_PERCENT, amount: formatINR(earnings) })
              : t('proposals.priceHintEmpty', { percent: PLATFORM_FEE_PERCENT })}
          </Text>
        </View>
        <Input
          label={t('proposals.days')}
          placeholder={t('proposals.daysPlaceholder')}
          value={days}
          onChangeText={(value) => setDays(digits(value, 3))}
          error={errors.days}
          keyboardType="number-pad"
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 12, paddingBottom: 14 },
  jobBox: { gap: 2, padding: 14, marginBottom: 18, borderRadius: radius.card, backgroundColor: colors.tintBlue },
  jobLabel: { ...type.caption, color: colors.accent },
  jobTitle: { ...type.subheading, color: colors.text },
  form: { gap: 20 },
  group: { gap: 8 },
  hint: { ...type.small, color: colors.muted },
  error: { ...type.small, color: colors.danger },
});
