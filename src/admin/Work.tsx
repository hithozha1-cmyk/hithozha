import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { FilterChips } from '@/components/FilterChips';
import { Input } from '@/components/Input';
import { StatusChip, type ChipTone } from '@/components/StatusChip';
import { closeJob, fetchJobs, fetchOrders, type AdminJob, type AdminOrder } from '@/lib/admin';
import { budgetRange, sanitizeSearch } from '@/lib/jobs';
import { formatINR } from '@/lib/money';
import { colors, type } from '@/theme';

import { Empty, ErrorLine, Field, Loading, LoadMore, ReasonAction, usePaged, useWhen } from './ui';

const ORDER_TONE: Record<string, ChipTone> = {
  awaiting_payment: 'warning',
  in_progress: 'info',
  delivered: 'info',
  disputed: 'danger',
  completed: 'success',
  cancelled: 'neutral',
};

export function Jobs() {
  const { t } = useTranslation();
  const when = useWhen();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const list = usePaged<AdminJob>((offset) => fetchJobs(search, status, offset), [search, status]);

  return (
    <View style={styles.wrap}>
      <Input
        label={t('admin.jobs.search')}
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => setSearch(sanitizeSearch(text))}
        onBlur={() => setSearch(sanitizeSearch(text))}
        returnKeyType="search"
      />
      <FilterChips
        accessibilityLabel={t('admin.jobs.status')}
        selected={status}
        onChange={setStatus}
        options={[
          { value: null, label: t('admin.all') },
          { value: 'open', label: t('admin.jobs.open') },
          { value: 'closed', label: t('admin.jobs.closed') },
        ]}
      />
      {list.failed ? <ErrorLine text={t('admin.failed')} /> : null}
      {list.items.map((j) => (
        <Card key={j.id} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.name}>{j.title}</Text>
            <StatusChip tone={j.status === 'open' ? 'success' : 'neutral'} label={t(`admin.jobs.${j.status}`)} />
          </View>
          <Text style={styles.sub}>{j.poster_name} · {budgetRange(j)} · {when(j.created_at)}</Text>
          <Text style={styles.sub}>{t('admin.jobs.proposals', { count: Number(j.proposals) })}{j.has_live_order ? ` · ${t('admin.jobs.liveOrder')}` : ''}</Text>
          {j.status === 'open' && !j.has_live_order ? (
            <ReasonAction
              label={t('admin.jobs.close')}
              confirmLabel={t('admin.jobs.closeConfirm')}
              placeholder={t('admin.jobs.reason')}
              onSubmit={async (reason) => {
                const r = await closeJob(j.id, reason);
                if (r.ok) await list.reload();
                return r.ok;
              }}
            />
          ) : null}
        </Card>
      ))}
      {list.loading && list.items.length === 0 ? <Loading /> : null}
      {!list.loading && list.items.length === 0 && !list.failed ? <Empty text={t('admin.nothing')} /> : null}
      <LoadMore more={list.more} loading={list.loading} onPress={() => void list.loadMore()} />
    </View>
  );
}

export function Orders() {
  const { t } = useTranslation();
  const when = useWhen();
  const [status, setStatus] = useState<string | null>(null);
  const list = usePaged<AdminOrder>((offset) => fetchOrders(status, offset), [status]);

  return (
    <View style={styles.wrap}>
      <FilterChips
        accessibilityLabel={t('admin.orders.status')}
        selected={status}
        onChange={setStatus}
        options={[
          { value: null, label: t('admin.all') },
          ...['awaiting_payment', 'in_progress', 'delivered', 'disputed', 'completed', 'cancelled'].map((value) => ({ value, label: t(`admin.orders.${value}`) })),
        ]}
      />
      {list.failed ? <ErrorLine text={t('admin.failed')} /> : null}
      {list.items.map((o) => (
        <Card key={o.id} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.name}>{o.title}</Text>
            <StatusChip tone={ORDER_TONE[o.status] ?? 'neutral'} label={t(`admin.orders.${o.status}`)} />
          </View>
          <Text style={styles.sub}>{t('admin.orders.parties', { client: o.client_name ?? '', freelancer: o.freelancer_name ?? '' })}</Text>
          <Field label={t('admin.orders.amount')} value={t('admin.orders.amountLine', { amount: formatINR(o.amount_paise), fee: formatINR(o.platform_fee_paise) })} />
          <Field label={t('admin.orders.payment')} value={o.payment_status ? t(`admin.payment.${o.payment_status}`) : '—'} />
          {o.paid_out_at ? <Field label={t('admin.orders.paidOut')} value={`${when(o.paid_out_at)} · ${o.payout_reference ?? ''}`} /> : null}
        </Card>
      ))}
      {list.loading && list.items.length === 0 ? <Loading /> : null}
      {!list.loading && list.items.length === 0 && !list.failed ? <Empty text={t('admin.nothing')} /> : null}
      <LoadMore more={list.more} loading={list.loading} onPress={() => void list.loadMore()} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { ...type.subheading, color: colors.text, flex: 1 },
  sub: { ...type.small, color: colors.muted },
});
