import { useRouter } from 'expo-router';
import { Coins } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { commissionPercent, fetchMyPlan, fetchTokens, type MyPlan, type Tokens } from '@/lib/tokens';
import { colors, type } from '@/theme';

/** Profile card: your plan, and (for freelancers) your tokens. */
export function PlanCard({ freelancer, client }: { freelancer: boolean; client: boolean }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [freelancerPlan, setFreelancerPlan] = useState<MyPlan | null>(null);
  const [clientPlan, setClientPlan] = useState<MyPlan | null>(null);

  const load = useCallback(async () => {
    if (freelancer) {
      setTokens(await fetchTokens());
      setFreelancerPlan(await fetchMyPlan('freelancer'));
    }
    if (client) setClientPlan(await fetchMyPlan('client'));
  }, [freelancer, client]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!tokens && !freelancerPlan && !clientPlan) return null;
  const date = (d: Date) => d.toLocaleDateString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'long' });

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Coins size={20} color={colors.primary} strokeWidth={2} />
        <Text style={styles.title}>{t('plans.cardTitle')}</Text>
      </View>

      {freelancerPlan && tokens ? (
        <View style={styles.block}>
          <Text style={styles.big}>{t('plans.tokensTotal', { count: tokens.total })}</Text>
          <Text style={styles.small}>{t('plans.tokensSplit', { free: tokens.free, bought: tokens.bought })}</Text>
          <Text style={styles.small}>{t('plans.freeResets', { date: date(tokens.resetsAt) })}</Text>
          <Text style={styles.body}>
            {t('plans.yourPlan', { name: freelancerPlan.name })} · {t('plans.commission', { percent: commissionPercent(freelancerPlan.commissionBps) })}
          </Text>
          {freelancerPlan.expiresAt ? <Text style={styles.small}>{t('plans.until', { date: date(freelancerPlan.expiresAt) })}</Text> : null}
        </View>
      ) : null}

      {clientPlan ? (
        <View style={styles.block}>
          <Text style={styles.body}>
            {t('plans.yourClientPlan', { name: clientPlan.name })} ·{' '}
            {clientPlan.maxOpenJobs === null ? t('plans.unlimitedJobs') : t('plans.openJobs', { count: clientPlan.maxOpenJobs })}
          </Text>
          {clientPlan.expiresAt ? <Text style={styles.small}>{t('plans.until', { date: date(clientPlan.expiresAt) })}</Text> : null}
        </View>
      ) : null}

      <Button variant="outline" title={t('plans.seePlans')} onPress={() => router.push('/account/plans')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, marginTop: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...type.subheading, color: colors.text },
  block: { gap: 4 },
  big: { ...type.heading, color: colors.primary },
  body: { ...type.body, color: colors.text },
  small: { ...type.small, color: colors.muted },
});
