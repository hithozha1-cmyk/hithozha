import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { formatINR } from '@/lib/money';
import { commissionPercent, fetchMyPlan, fetchPlans, type Audience, type MyPlan, type PlanInfo } from '@/lib/tokens';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

/** The price list: what each plan gives, which one you are on, and how tokens work. */
export default function PlansScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuth();
  const [plans, setPlans] = useState<PlanInfo[] | null>(null);
  const [mine, setMine] = useState<Partial<Record<Audience, MyPlan>>>({});

  const isFreelancer = profile?.role === 'freelancer' || profile?.role === 'both';
  const isClient = profile?.role === 'client' || profile?.role === 'both';
  const audiences: Audience[] = [...(isFreelancer ? (['freelancer'] as const) : []), ...(isClient ? (['client'] as const) : [])];

  useEffect(() => {
    void fetchPlans().then(setPlans);
    void (async () => {
      const found: Partial<Record<Audience, MyPlan>> = {};
      for (const a of ['freelancer', 'client'] as const) {
        const plan = await fetchMyPlan(a);
        if (plan) found[a] = plan;
      }
      setMine(found);
    })();
  }, []);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.heading}>{t('plans.title')}</Text>
      <Text style={styles.note}>{t('plans.notBuyable')}</Text>

      {audiences.map((audience) => (
        <View key={audience} style={styles.group}>
          <Text style={styles.groupTitle}>{t(`plans.for.${audience}`)}</Text>
          {(plans ?? [])
            .filter((p) => p.audience === audience)
            .map((p) => (
              <Card key={p.code} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.name}>{p.name}</Text>
                  {mine[audience]?.code === p.code ? <StatusChip tone="success" label={t('plans.current')} /> : null}
                </View>
                <Text style={styles.price}>{p.price_month_paise === 0 ? t('plans.free') : t('plans.perMonth', { price: formatINR(p.price_month_paise) })}</Text>
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
              </Card>
            ))}
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
      <Check size={16} color={colors.success} strokeWidth={2.4} />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  heading: { ...type.heading, color: colors.text },
  note: { ...type.small, color: colors.muted, marginVertical: 8 },
  group: { gap: 10, marginTop: 14 },
  groupTitle: { ...type.subheading, color: colors.text },
  card: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...type.subheading, color: colors.text },
  price: { ...type.label, color: colors.primary },
  small: { ...type.small, color: colors.muted },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineText: { ...type.body, color: colors.text, flex: 1 },
});
