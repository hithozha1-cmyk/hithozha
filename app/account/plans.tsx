import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { confirmAction } from '@/lib/confirm';
import { formatINR } from '@/lib/money';
import {
  activeSubscription,
  cancelSubscription,
  createSubscription,
  fetchMySubscriptions,
  type BillingCycle,
  type Subscription,
} from '@/lib/subscriptions';
import { commissionPercent, fetchMyPlan, fetchPlans, type Audience, type MyPlan, type PlanInfo } from '@/lib/tokens';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, type } from '@/theme';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The price list: what each plan gives, which one you are on, and how tokens work. */
export default function PlansScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { profile } = useAuth();
  const [plans, setPlans] = useState<PlanInfo[] | null>(null);
  const [mine, setMine] = useState<Partial<Record<Audience, MyPlan>>>({});
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  // A subscribe button is keyed "code-cycle"; a cancel button is keyed by the subscription id.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isFreelancer = profile?.role === 'freelancer' || profile?.role === 'both';
  const isClient = profile?.role === 'client' || profile?.role === 'both';
  const audiences: Audience[] = [...(isFreelancer ? (['freelancer'] as const) : []), ...(isClient ? (['client'] as const) : [])];

  const when = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const reload = async () => {
    const [found, subs] = await Promise.all([
      (async () => {
        const result: Partial<Record<Audience, MyPlan>> = {};
        for (const a of ['freelancer', 'client'] as const) {
          const plan = await fetchMyPlan(a);
          if (plan) result[a] = plan;
        }
        return result;
      })(),
      fetchMySubscriptions(),
    ]);
    setMine(found);
    if (subs) setSubscriptions(subs);
  };

  useEffect(() => {
    void fetchPlans().then(setPlans);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const subscribe = async (plan: PlanInfo, cycle: BillingCycle) => {
    const key = `${plan.code}-${cycle}`;
    setBusy(key);
    setError(null);
    const started = await createSubscription(plan.code, cycle);
    if (started.status !== 'ok') {
      setBusy(null);
      setError(t(started.status === 'not_enabled' ? 'plans.subscribeNotEnabled' : 'plans.subscribeFailed'));
      return;
    }
    await WebBrowser.openBrowserAsync(started.url);
    // Razorpay tells us about the first charge a moment later, so check for a short while.
    for (let attempt = 0; attempt < 10; attempt++) {
      const subs = await fetchMySubscriptions();
      if (subs) setSubscriptions(subs);
      if (subs && activeSubscription(subs, plan.audience)?.plan_code === plan.code) break;
      await sleep(3000);
    }
    const freshPlan = await fetchMyPlan(plan.audience);
    if (freshPlan) setMine((current) => ({ ...current, [plan.audience]: freshPlan }));
    setBusy(null);
  };

  const cancel = (subscription: Subscription) =>
    confirmAction({
      title: t('plans.cancelConfirmTitle'),
      message: t('plans.cancelConfirmBody'),
      confirmLabel: t('plans.cancelSubscription'),
      cancelLabel: t('common.cancel'),
      destructive: true,
      onConfirm: () => {
        setBusy(subscription.id);
        setError(null);
        void cancelSubscription(subscription.id).then(async (ok) => {
          if (!ok) setError(t('plans.cancelFailed'));
          const subs = await fetchMySubscriptions();
          if (subs) setSubscriptions(subs);
          setBusy(null);
        });
      },
    });

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.heading}>{t('plans.title')}</Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {audiences.map((audience) => (
        <View key={audience} style={styles.group}>
          <Text style={styles.groupTitle}>{t(`plans.for.${audience}`)}</Text>
          {(plans ?? [])
            .filter((p) => p.audience === audience)
            .map((p) => {
              const current = mine[audience]?.code === p.code;
              const paid = p.price_month_paise > 0;
              const subscription = paid && current ? activeSubscription(subscriptions, audience) : null;
              return (
                <Card key={p.code} style={[styles.card, current && styles.cardCurrent]}>
                  <View style={styles.row}>
                    <Text style={styles.name}>{p.name}</Text>
                    {current ? <StatusChip tone="success" label={t('plans.current')} /> : null}
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{p.price_month_paise === 0 ? t('plans.free') : formatINR(p.price_month_paise)}</Text>
                    {paid ? <Text style={styles.pricePeriod}>{t('plans.perMonthSuffix')}</Text> : null}
                  </View>
                  {p.price_year_paise > 0 ? <Text style={styles.small}>{t('plans.perYear', { price: formatINR(p.price_year_paise) })}</Text> : null}
                  {audience === 'freelancer' ? (
                    <>
                      <Line text={t('plans.lines.tokens', { count: p.monthly_tokens })} />
                      <Line text={t('plans.lines.commission', { percent: commissionPercent(p.commission_bps) })} />
                      <Line text={p.max_packages === null ? t('plans.lines.packagesUnlimited') : t('plans.lines.packages', { count: p.max_packages })} />
                    </>
                  ) : (
                    <Line text={p.max_open_jobs === null ? t('plans.lines.jobsUnlimited') : t('plans.lines.jobs', { count: p.max_open_jobs })} />
                  )}

                  {paid && !current ? (
                    <View style={styles.subscribeRow}>
                      <Button
                        title={t('plans.subscribeMonthly')}
                        onPress={() => void subscribe(p, 'month')}
                        loading={busy === `${p.code}-month`}
                        disabled={busy !== null}
                        style={styles.subscribeButton}
                      />
                      {p.price_year_paise > 0 ? (
                        <Button
                          variant="outline"
                          title={t('plans.subscribeYearly')}
                          onPress={() => void subscribe(p, 'year')}
                          loading={busy === `${p.code}-year`}
                          disabled={busy !== null}
                          style={styles.subscribeButton}
                        />
                      ) : null}
                    </View>
                  ) : null}

                  {subscription?.current_period_end ? (
                    <View style={styles.renewBox}>
                      <Text style={styles.renewText}>
                        {subscription.cancel_requested
                          ? t('plans.cancelsOn', { date: when(subscription.current_period_end) })
                          : t('plans.renewsOn', { date: when(subscription.current_period_end) })}
                      </Text>
                      {!subscription.cancel_requested ? (
                        <Pressable accessibilityRole="button" onPress={() => cancel(subscription)} disabled={busy !== null}>
                          <Text style={styles.cancelLink}>{busy === subscription.id ? t('plans.cancelling') : t('plans.cancelSubscription')}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </Card>
              );
            })}
        </View>
      ))}

      <View style={styles.group}>
        <Text style={styles.groupTitle}>{t('plans.rules.title')}</Text>
        {(['apply', 'free', 'spend', 'refund', 'nocash'] as const).map((rule) => (
          <Line key={rule} text={t(`plans.rules.${rule}`)} />
        ))}
      </View>
    </Screen>
  );
}

function Line({ text }: { text: string }) {
  return (
    <View style={styles.line}>
      <View style={styles.lineCheck}>
        <Check size={13} color={colors.success} strokeWidth={3} />
      </View>
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  heading: { ...type.heading, color: colors.text },
  error: { ...type.small, color: colors.danger, marginTop: 4 },
  group: { gap: 10, marginTop: 14 },
  groupTitle: { ...type.subheading, color: colors.text },
  card: { gap: 8 },
  cardCurrent: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.tintRedSoft },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...type.subheading, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  price: { ...type.title, fontSize: 26, color: colors.primary },
  pricePeriod: { ...type.small, color: colors.muted },
  small: { ...type.small, color: colors.muted },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineCheck: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineText: { ...type.body, color: colors.text, flex: 1 },
  subscribeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  subscribeButton: { flexGrow: 1, flexBasis: 150 },
  renewBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 },
  renewText: { ...type.small, color: colors.muted, flex: 1 },
  cancelLink: { ...type.label, color: colors.danger },
});
