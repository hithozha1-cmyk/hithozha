import { ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ReasonAction } from '@/admin/ui';
import { Button } from '@/components/Button';
import { formatINR } from '@/lib/money';
import { openDispute, withdrawDispute, type Dispute, type Order } from '@/lib/orders';
import { colors, radius, type } from '@/theme';

type Props = {
  order: Order;
  dispute: Dispute | null;
  userId: string | undefined;
  onChanged: () => Promise<unknown>;
};

/** Report a problem on a paid order, follow an open dispute, or read how it was decided. */
export function DisputePanel({ order, dispute, userId, onChanged }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const isClient = order.client_id === userId;

  if (!dispute) {
    if (order.status !== 'in_progress' && order.status !== 'delivered') return null;
    return (
      <View style={styles.box}>
        <ReasonAction
          label={t('dispute.report')}
          confirmLabel={t('dispute.send')}
          placeholder={t('dispute.describe')}
          validate={(text) => text.trim().length >= 10}
          onSubmit={async (reason) => {
            const result = await openDispute(order.id, reason);
            if (result.ok) await onChanged();
            return result.ok;
          }}
        />
        <Text style={styles.small}>{t('dispute.reportHint')}</Text>
      </View>
    );
  }

  if (dispute.status === 'open') {
    const mine = dispute.opened_by === userId;
    return (
      <View style={[styles.box, styles.alert]}>
        <View style={styles.head}>
          <ShieldAlert size={18} color={colors.danger} strokeWidth={2} />
          <Text style={styles.title}>{t('dispute.openTitle')}</Text>
        </View>
        <Text style={styles.small}>{mine ? t('dispute.openedByYou') : t('dispute.openedByOther')}</Text>
        <Text style={styles.quote}>{dispute.reason}</Text>
        <Text style={styles.small}>{t('dispute.reviewing')}</Text>
        {mine ? (
          <Button
            variant="outline"
            title={t('dispute.withdraw')}
            loading={busy}
            onPress={() => {
              setBusy(true);
              void withdrawDispute(dispute.id).then(async () => {
                await onChanged();
                setBusy(false);
              });
            }}
          />
        ) : null}
      </View>
    );
  }

  const refund = dispute.refund_paise ?? 0;
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('dispute.decidedTitle')}</Text>
      <Text style={styles.body}>
        {dispute.resolution === 'refund'
          ? t('dispute.decidedRefund', { amount: formatINR(refund) })
          : dispute.resolution === 'split'
            ? t('dispute.decidedSplit', { refund: formatINR(refund), earnings: formatINR(order.freelancer_earnings_paise) })
            : t('dispute.decidedRelease')}
      </Text>
      {dispute.decision_note ? <Text style={styles.quote}>{dispute.decision_note}</Text> : null}
      {refund > 0 ? <Text style={styles.small}>{isClient ? t('dispute.refundSentClient') : t('dispute.refundSentFreelancer')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10, marginTop: 16, padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  alert: { borderColor: colors.danger, backgroundColor: colors.tintRedSoft },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...type.label, color: colors.text },
  body: { ...type.body, color: colors.text },
  small: { ...type.small, color: colors.muted },
  quote: { ...type.body, color: colors.text, backgroundColor: colors.background, padding: 12, borderRadius: radius.input },
});
