import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { FilterChips } from '@/components/FilterChips';
import { fetchRevenue, fetchStats, type AdminStats, type RevenueRow } from '@/lib/admin';
import { formatINR } from '@/lib/money';
import { colors, type } from '@/theme';

import { Empty, ErrorLine, Loading } from './ui';

type Props = { goTo: (section: 'verifications' | 'payouts' | 'chats' | 'disputes') => void };

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'alert' }) {
  return (
    <Card style={styles.tile}>
      <Text style={[styles.tileValue, tone === 'alert' && styles.alert]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </Card>
  );
}

export function Overview({ goTo }: Props) {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [granularity, setGranularity] = useState<'day' | 'month'>('day');
  const [revenue, setRevenue] = useState<RevenueRow[] | null>(null);

  useEffect(() => {
    void fetchStats().then((r) => (r.ok ? setStats(r.data) : setFailed(true)));
  }, []);

  useEffect(() => {
    setRevenue(null);
    void fetchRevenue(granularity).then((r) => setRevenue(r.ok ? r.data : []));
  }, [granularity]);

  if (failed) return <ErrorLine text={t('admin.failed')} />;
  if (!stats) return <Loading />;

  const n = (value: number) => value.toLocaleString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN');
  const label = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', granularity === 'day' ? { day: 'numeric', month: 'short' } : { month: 'long', year: 'numeric' });

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>{t('admin.overview.needsYou')}</Text>
      <View style={styles.grid}>
        <TapTile onPress={() => goTo('disputes')}>
          <Tile label={t('admin.overview.disputes')} value={n(stats.disputes_open)} tone={stats.disputes_open > 0 ? 'alert' : undefined} />
        </TapTile>
        <TapTile onPress={() => goTo('verifications')}>
          <Tile label={t('admin.overview.verifications')} value={n(stats.verifications_pending)} tone={stats.verifications_pending > 0 ? 'alert' : undefined} />
        </TapTile>
        <TapTile onPress={() => goTo('payouts')}>
          <Tile label={t('admin.overview.payoutsDue', { amount: formatINR(stats.payouts_due_paise) })} value={n(stats.payouts_due_count)} tone={stats.payouts_due_count > 0 ? 'alert' : undefined} />
        </TapTile>
        <TapTile onPress={() => goTo('chats')}>
          <Tile label={t('admin.overview.flagged')} value={n(stats.flagged_week)} tone={stats.flagged_week > 0 ? 'alert' : undefined} />
        </TapTile>
      </View>

      <Text style={styles.heading}>{t('admin.overview.today')}</Text>
      <View style={styles.grid}>
        <Tile label={t('admin.overview.signups')} value={n(stats.signups_today)} />
        <Tile label={t('admin.overview.proposals')} value={n(stats.proposals_today)} />
        <Tile label={t('admin.overview.jobsOpen')} value={n(stats.jobs_open)} />
        <Tile label={t('admin.overview.ordersActive')} value={n(stats.orders_active)} />
      </View>

      <Text style={styles.heading}>{t('admin.overview.people')}</Text>
      <View style={styles.grid}>
        <Tile label={t('admin.overview.users')} value={n(stats.users)} />
        <Tile label={t('admin.overview.freelancers')} value={n(stats.freelancers)} />
        <Tile label={t('admin.overview.clients')} value={n(stats.clients)} />
        <Tile label={t('admin.overview.suspended')} value={n(stats.suspended)} />
      </View>

      <Text style={styles.heading}>{t('admin.overview.money')}</Text>
      <View style={styles.grid}>
        <Tile label={t('admin.overview.held')} value={formatINR(stats.held_paise)} />
        <Tile label={t('admin.overview.volume')} value={formatINR(stats.paid_volume_paise)} />
        <Tile label={t('admin.overview.fees')} value={formatINR(stats.platform_fees_paise)} />
        <Tile label={t('admin.overview.completed')} value={n(stats.orders_completed)} />
      </View>

      <Text style={styles.heading}>{t('admin.overview.revenue')}</Text>
      <FilterChips
        accessibilityLabel={t('admin.overview.revenue')}
        selected={granularity}
        onChange={(value) => setGranularity(value === 'month' ? 'month' : 'day')}
        options={[
          { value: 'day', label: t('admin.overview.perDay') },
          { value: 'month', label: t('admin.overview.perMonth') },
        ]}
      />
      {revenue === null ? (
        <Loading />
      ) : revenue.length === 0 ? (
        <Empty text={t('admin.overview.noRevenue')} />
      ) : (
        <Card style={styles.table}>
          {revenue.map((row) => (
            <View key={row.period} style={styles.revenueRow}>
              <Text style={styles.revenueDate}>{label(row.period)}</Text>
              <Text style={styles.revenueOrders}>{t('admin.overview.orderCount', { count: row.orders })}</Text>
              <Text style={styles.revenueFee}>{formatINR(Number(row.fees_paise))}</Text>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

// A tile that can be tapped to jump to the section that needs attention.
function TapTile({ onPress, children }: { onPress: () => void; children: ReactNode }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.cell}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  heading: { ...type.subheading, color: colors.text, marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexGrow: 1, flexBasis: 150 },
  tile: { flexGrow: 1, flexBasis: 150, gap: 4 },
  tileValue: { ...type.heading, color: colors.text },
  tileLabel: { ...type.small, color: colors.muted },
  alert: { color: colors.primary },
  table: { gap: 10 },
  revenueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  revenueDate: { ...type.bodyStrong, color: colors.text, flex: 1 },
  revenueOrders: { ...type.small, color: colors.muted },
  revenueFee: { ...type.bodyStrong, color: colors.success, minWidth: 90, textAlign: 'right' },
});
