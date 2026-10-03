import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { LIMIT_REACHED_CODE, fetchApplicationCredits, type ApplicationCredits } from '@/lib/credits';
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
  const { t, i18n } = useTranslation();
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
  const [credits, setCredits] = useState<ApplicationCredits | null>(null);

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

  useEffect(() => {
    void fetchApplicationCredits().then(setCredits);
  }, []);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!isFreelancerRole(profile?.role ?? null)) return <Redirect href="/" />;

  if (profile?.verification_status !== 'verified') {
    return (
      <Screen scroll={false} footer={<Button title={t('identity.action')} onPress={() => router.push('/account/verify-identity')} />}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>{t('identity.applyBlockedTitle')}</Text>
        <Text style={styles.applyBlocked}>{t('identity.applyBlockedBody')}</Text>
      </Screen>
    );
  }

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
    if (credits && credits.remaining === 0) return setFormError(t('credits.limitReached'));
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
      if (error.code === LIMIT_REACHED_CODE) {
        setFormError(t('credits.limitReached'));
        void fetchApplicationCredits().then(setCredits);
      } else {
        setFormError(error.code === '23505' ? t(`${e}.alreadyApplied`) : t(`${e}.failed`));
      }
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
      {credits ? (
        <View style={[styles.creditBox, credits.remaining === 0 && styles.creditBoxEmpty]} accessibilityRole="summary">
          <Text style={styles.creditTitle}>{t('credits.left', { remaining: credits.remaining, allowed: credits.allowed })}</Text>
          <Text style={styles.creditHint}>
            {credits.remaining === 0 ? t('credits.noneLeft') : t('credits.resets')}{' '}
            {t('credits.resetsOn', { date: credits.resetsAt.toLocaleDateString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'long' }) })}
          </Text>
        </View>
      ) : null}
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
  creditBox: { marginBottom: 12, padding: 12, borderRadius: radius.card, backgroundColor: colors.tintBlue, gap: 2 },
  creditBoxEmpty: { backgroundColor: colors.tintRedSoft },
  creditTitle: { ...type.label, color: colors.text },
  creditHint: { ...type.small, color: colors.muted },
  applyBlocked: { ...type.body, color: colors.muted },
  jobBox: { gap: 2, padding: 14, marginBottom: 18, borderRadius: radius.card, backgroundColor: colors.tintBlue },
  jobLabel: { ...type.caption, color: colors.accent },
  jobTitle: { ...type.subheading, color: colors.text },
  form: { gap: 20 },
  group: { gap: 8 },
  hint: { ...type.small, color: colors.muted },
  error: { ...type.small, color: colors.danger },
});
