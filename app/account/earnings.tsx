import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, Wallet } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { fetchEarningsOrders, orderPaidOutAt, summarizeEarnings, type EarningsOrder } from '@/lib/earnings';
import { formatINR } from '@/lib/money';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

function Total({ label, hint, paise, strong }: { label: string; hint: string; paise: number; strong?: boolean }) {
  return (
    <Card style={styles.total}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={[styles.totalValue, strong && { color: colors.success }]}>{formatINR(paise)}</Text>
      <Text style={styles.hint}>{hint}</Text>
    </Card>
  );
}

/** What a freelancer has earned: held, released and waiting for payout, and already paid. */
export default function EarningsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const [orders, setOrders] = useState<EarningsOrder[] | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      void fetchEarningsOrders(session.user.id).then((result) => {
        setOrders(result ?? []);
        setLoading(false);
      });
    }, [session]),
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const summary = summarizeEarnings(orders ?? []);
  const locale = i18n.language === 'ta' ? 'ta-IN' : 'en-IN';
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title}>{t('earnings.title')}</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.totals}>
            <Total label={t('earnings.inEscrow')} hint={t('earnings.inEscrowHint')} paise={summary.inEscrow} />
            <Total label={t('earnings.awaitingPayout')} hint={t('earnings.awaitingPayoutHint')} paise={summary.awaitingPayout} />
            <Total label={t('earnings.paidOut')} hint={t('earnings.paidOutHint')} paise={summary.paidOut} strong />
          </View>

          <Text style={styles.section}>{t('earnings.history')}</Text>
          {orders && orders.length > 0 ? (
            <View style={styles.list}>
              {orders.map((order) => {
                const paid = orderPaidOutAt(order);
                const label = order.status === 'completed' ? (paid ? t('earnings.paidOn', { date: day(paid) }) : t('earnings.awaitingPayout')) : t(`orders.status.${order.status}`);
                return (
                  <Card key={order.id} style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={2}>
                        {order.title}
                      </Text>
                      <StatusChip label={label} tone={paid ? 'success' : order.status === 'completed' ? 'warning' : 'info'} />
                    </View>
                    <Text style={styles.rowAmount}>{formatINR(order.freelancer_earnings_paise)}</Text>
                  </Card>
                );
              })}
            </View>
          ) : (
            <View style={styles.empty}>
              <EmptyState icon={Wallet} title={t('earnings.emptyTitle')} message={t('earnings.emptyBody')} />
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 12, paddingBottom: 14 },
  loader: { marginTop: 40 },
  totals: { gap: 12 },
  total: { gap: 2 },
  totalLabel: { ...type.label, color: colors.muted },
  totalValue: { ...type.title, color: colors.text },
  hint: { ...type.small, color: colors.muted },
  section: { ...type.subheading, color: colors.text, marginTop: 24, marginBottom: 10 },
  list: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowText: { flex: 1, gap: 6 },
  rowTitle: { ...type.bodyStrong, color: colors.text },
  rowAmount: { ...type.heading, fontSize: 18, color: colors.primaryPressed },
  empty: { minHeight: 260 },
});
