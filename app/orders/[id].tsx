import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronLeft, ClipboardList, Lock, MessageCircle } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CompanyLogo } from '@/components/CompanyLogo';
import { DisputePanel } from '@/components/DisputePanel';
import { EmptyState } from '@/components/EmptyState';
import { ORDER_TONE } from '@/components/OrderCard';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { Stars } from '@/components/Stars';
import { subscribeToOrder } from '@/lib/chat';
import { confirmAction } from '@/lib/confirm';
import { formatINR } from '@/lib/money';
import {
  cancelUnpaidOrder,
  completeOrder,
  createPaymentLink,
  fetchDispute,
  fetchOrder,
  markOrderDelivered,
  type Dispute,
  type Order,
} from '@/lib/orders';
import { PLATFORM_FEE_PERCENT, fetchConversationId } from '@/lib/proposals';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, type } from '@/theme';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong]}>{value}</Text>
    </View>
  );
}

export default function OrderDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'pay' | 'check' | 'cancel' | 'deliver' | 'approve' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [result, disputeResult] = await Promise.all([fetchOrder(id), fetchDispute(id)]);
    setOrder(result);
    setDispute(disputeResult);
    setLoading(false);
    return result;
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // A payment confirmed by the webhook shows up here without a manual refresh.
  useEffect(() => subscribeToOrder(id, () => void load()), [id, load]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

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

  if (!order) {
    return (
      <Screen scroll={false}>
        {back}
        <EmptyState icon={ClipboardList} title={t('orders.detail.notFoundTitle')} message={t('orders.detail.notFoundBody')} />
      </Screen>
    );
  }

  const isClient = order.client_id === userId;
  const role = isClient ? 'client' : 'freelancer';
  const other = isClient ? order.freelancer : order.client;
  const otherName = !isClient && order.company ? order.company.name : other?.full_name;

  const run = (key: NonNullable<typeof busy>, task: () => Promise<boolean>, failure: string) => {
    setBusy(key);
    setError(null);
    void task().then(async (ok) => {
      if (!ok) setError(failure);
      await load();
      setBusy(null);
    });
  };

  const pay = async () => {
    setError(null);
    setBusy('pay');
    const url = await createPaymentLink(order.id);
    if (!url) {
      setBusy(null);
      setError(t('orders.actions.payFailed'));
      return;
    }
    await WebBrowser.openBrowserAsync(url);
    // Razorpay tells us about the payment a moment later, so check for a short while.
    setBusy('check');
    for (let attempt = 0; attempt < 10; attempt++) {
      const fresh = await load();
      if (fresh && fresh.status !== 'awaiting_payment') break;
      await sleep(3000);
    }
    setBusy(null);
  };

  const cancel = () =>
    confirmAction({
      title: t('orders.actions.cancelTitle'),
      message: t('orders.actions.cancelBody'),
      confirmLabel: t('orders.actions.cancel'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        setBusy('cancel');
        setError(null);
        void cancelUnpaidOrder(order.id).then(async (result) => {
          if (result === 'cancelled') {
            setBusy(null);
            goBack();
            return;
          }
          setError(result === 'already_paid' ? t('orders.actions.cancelPaid') : t('orders.actions.cancelFailed'));
          await load();
          setBusy(null);
        });
      },
    });

  const deliver = () =>
    confirmAction({
      title: t('orders.actions.deliverTitle'),
      message: t('orders.actions.deliverBody'),
      confirmLabel: t('orders.actions.markDelivered'),
      cancelLabel: t('common.cancel'),
      destructive: false,
      onConfirm: () => run('deliver', async () => (await markOrderDelivered(order.id)).ok, t('orders.actions.deliverFailed')),
    });

  const approve = () =>
    confirmAction({
      title: t('orders.actions.approveTitle'),
      message: t('orders.actions.approveBody'),
      confirmLabel: t('orders.actions.approve'),
      cancelLabel: t('common.cancel'),
      destructive: false,
      onConfirm: () => run('approve', async () => (await completeOrder(order.id)).ok, t('orders.actions.approveFailed')),
    });

  const openChat = async () => {
    setError(null);
    const conversationId = await fetchConversationId(order.proposal_id);
    if (conversationId) router.push({ pathname: '/chat/[id]', params: { id: conversationId } });
    else setError(t('common.genericError'));
  };

  const heldStatus = order.status === 'in_progress' || order.status === 'delivered';

  const footer = (
    <View style={styles.footer}>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {isClient && order.status === 'awaiting_payment' ? (
        <>
          <Button
            title={busy === 'check' ? t('orders.actions.checkingPayment') : t('orders.actions.pay', { amount: formatINR(order.amount_paise) })}
            onPress={() => void pay()}
            loading={busy === 'pay' || busy === 'check'}
          />
          <Button variant="outline" title={t('orders.actions.cancel')} onPress={cancel} loading={busy === 'cancel'} disabled={busy !== null} />
        </>
      ) : null}
      {!isClient && order.status === 'in_progress' ? (
        <Button title={t('orders.actions.markDelivered')} onPress={deliver} loading={busy === 'deliver'} />
      ) : null}
      {isClient && order.status === 'delivered' ? (
        <Button title={t('orders.actions.approve')} onPress={approve} loading={busy === 'approve'} />
      ) : null}
      {isClient && order.status === 'completed' && !order.review ? (
        <Button title={t('orders.actions.review')} onPress={() => router.push({ pathname: '/orders/review/[id]', params: { id: order.id } })} />
      ) : null}
      {order.status !== 'cancelled' ? (
        <Button
          variant="outline"
          title={t('orders.actions.message')}
          icon={<MessageCircle size={20} color={colors.text} strokeWidth={1.8} />}
          onPress={() => void openChat()}
        />
      ) : null}
    </View>
  );

  return (
    <Screen footer={footer}>
      {back}

      <Text style={styles.title}>{order.title}</Text>
      <View style={styles.statusRow}>
        <StatusChip label={t(`orders.status.${order.status}`)} tone={ORDER_TONE[order.status]} />
      </View>
      <Text style={styles.hint}>{t(`orders.hint.${order.status}.${role}`)}</Text>

      <Pressable
        accessibilityRole="button"
        disabled={!isClient}
        onPress={() => router.push({ pathname: '/freelancer/[id]', params: { id: order.freelancer_id } })}
        style={styles.person}
      >
        {!isClient && order.company ? (
          <CompanyLogo name={order.company.name} uri={order.company.logo_url} size={48} />
        ) : (
          <Avatar name={other?.full_name} uri={other?.avatar_url} size={48} />
        )}
        <View style={styles.personText}>
          <Text style={styles.personRole}>{isClient ? t('orders.detail.freelancer') : t('orders.detail.client')}</Text>
          <Text style={styles.personName} numberOfLines={1}>
            {otherName}
          </Text>
        </View>
      </Pressable>

      <Card style={styles.money}>
        {isClient ? (
          <Row label={t('orders.detail.youPay')} value={formatINR(order.amount_paise)} strong />
        ) : (
          <>
            <Row label={t('orders.detail.amount')} value={formatINR(order.amount_paise)} />
            <Row label={t('orders.detail.fee', { percent: PLATFORM_FEE_PERCENT })} value={`− ${formatINR(order.platform_fee_paise)}`} />
            <Row label={t('orders.detail.youReceive')} value={formatINR(order.freelancer_earnings_paise)} strong />
          </>
        )}
        {order.refunded_paise > 0 ? <Row label={isClient ? t('orders.detail.refundedYou') : t('orders.detail.refundedClient')} value={formatINR(order.refunded_paise)} /> : null}
        <Row label={t('orders.detail.delivery')} value={t('orders.detail.days', { count: order.delivery_days })} />
      </Card>

      {heldStatus ? (
        <View style={styles.escrow}>
          <Lock size={18} color={colors.success} strokeWidth={2} />
          <View style={styles.escrowText}>
            <Text style={styles.escrowTitle}>{t('orders.escrow.heldTitle')}</Text>
            <Text style={styles.escrowBody}>{t(`orders.escrow.heldBody.${role}`)}</Text>
          </View>
        </View>
      ) : null}
      <DisputePanel order={order} dispute={dispute} userId={userId} onChanged={load} />

      {order.status === 'completed' ? (
        <View style={styles.escrow}>
          <Lock size={18} color={colors.success} strokeWidth={2} />
          <View style={styles.escrowText}>
            <Text style={styles.escrowTitle}>{t('orders.escrow.releasedTitle')}</Text>
            <Text style={styles.escrowBody}>
              {isClient ? t('orders.escrow.releasedBody.client') : t('orders.escrow.releasedBody.freelancer', { amount: formatINR(order.freelancer_earnings_paise) })}
            </Text>
          </View>
        </View>
      ) : null}

      {order.review ? (
        <View style={styles.reviewBox}>
          <Stars value={order.review.rating} size={18} />
          <Text style={styles.reviewText}>{t('orders.detail.rated', { rating: order.review.rating })}</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 8 },
  statusRow: { marginTop: 10 },
  hint: { ...type.body, color: colors.muted, marginTop: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, minHeight: 56 },
  personText: { flex: 1, gap: 1 },
  personRole: { ...type.caption, color: colors.muted },
  personName: { ...type.subheading, color: colors.text },
  money: { gap: 12, marginTop: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  rowLabel: { ...type.body, color: colors.muted, flex: 1 },
  rowValue: { ...type.bodyStrong, color: colors.text },
  rowStrong: { ...type.heading, fontSize: 20, color: colors.primaryPressed },
  escrow: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    marginTop: 16,
    borderRadius: radius.card,
    backgroundColor: colors.successBg,
  },
  escrowText: { flex: 1, gap: 2 },
  escrowTitle: { ...type.label, color: colors.success },
  escrowBody: { ...type.small, color: colors.success },
  reviewBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  reviewText: { ...type.small, color: colors.muted },
  footer: { gap: 10 },
  error: { ...type.small, color: colors.danger },
});
