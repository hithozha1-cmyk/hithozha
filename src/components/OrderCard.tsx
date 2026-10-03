import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { CompanyLogo } from '@/components/CompanyLogo';
import { StatusChip, type ChipTone } from '@/components/StatusChip';
import { formatINR } from '@/lib/money';
import type { Order, OrderStatus } from '@/lib/orders';
import { colors, radius, type } from '@/theme';

export const ORDER_TONE: Record<OrderStatus, ChipTone> = {
  awaiting_payment: 'warning',
  in_progress: 'info',
  delivered: 'info',
  completed: 'success',
  cancelled: 'neutral',
};

/** One row in the Orders list, written from the signed-in user's point of view. */
export function OrderCard({ order, userId }: { order: Order; userId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const isClient = order.client_id === userId;
  const other = isClient ? order.freelancer : order.client;
  const otherName = isClient ? other?.full_name : (order.company?.name ?? other?.full_name);
  // Clients see what they pay; freelancers see what they will receive.
  const amount = isClient ? order.amount_paise : order.freelancer_earnings_paise;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={order.title}
      onPress={() => router.push({ pathname: '/orders/[id]', params: { id: order.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        {!isClient && order.company ? (
          <CompanyLogo name={order.company.name} uri={order.company.logo_url} size={40} />
        ) : (
          <Avatar name={other?.full_name} uri={other?.avatar_url} size={40} />
        )}
        <View style={styles.topText}>
          <Text style={styles.who} numberOfLines={1}>
            {otherName}
          </Text>
          <Text style={styles.role}>{isClient ? t('orders.detail.freelancer') : t('orders.detail.client')}</Text>
        </View>
        <StatusChip label={t(`orders.status.${order.status}`)} tone={ORDER_TONE[order.status]} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {order.title}
      </Text>
      <Text style={styles.amount}>{isClient ? t('orders.card.youPay', { amount: formatINR(amount) }) : t('orders.card.youReceive', { amount: formatINR(amount) })}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 16, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  pressed: { backgroundColor: colors.background },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topText: { flex: 1, gap: 1 },
  who: { ...type.label, color: colors.text },
  role: { ...type.caption, color: colors.muted },
  title: { ...type.subheading, color: colors.text },
  amount: { ...type.bodyStrong, color: colors.primaryPressed },
});
