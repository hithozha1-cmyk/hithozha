import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChips } from '@/components/FilterChips';
import { StatusChip } from '@/components/StatusChip';
import { closeReport, fetchReports, type AdminReport, type ReportFilter } from '@/lib/admin';
import { colors, type } from '@/theme';

import { Empty, ErrorLine, Loading, LoadMore, ReasonAction, usePaged, useWhen } from './ui';

export function Reports() {
  const { t } = useTranslation();
  const when = useWhen();
  const [filter, setFilter] = useState<ReportFilter>('open');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = usePaged<AdminReport>((offset) => fetchReports(filter, offset), [filter]);

  const dismiss = async (id: string) => {
    setBusy(id);
    setError(null);
    const r = await closeReport(id, 'dismissed', null);
    if (!r.ok) setError(t('admin.failed'));
    await list.reload();
    setBusy(null);
  };

  return (
    <View style={styles.wrap}>
      <FilterChips
        accessibilityLabel={t('admin.reports.filter')}
        selected={filter}
        onChange={(value) => setFilter((value as ReportFilter) ?? 'open')}
        options={[
          { value: 'open', label: t('admin.reports.open') },
          { value: 'closed', label: t('admin.reports.closed') },
          { value: 'all', label: t('admin.all') },
        ]}
      />
      <ErrorLine text={error} />
      {list.failed ? <ErrorLine text={t('admin.failed')} /> : null}
      {list.items.map((r) => (
        <Card key={r.id} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.name}>{r.target_name ?? t('admin.users.noName')}</Text>
            <StatusChip tone={r.status === 'open' ? 'warning' : r.status === 'actioned' ? 'success' : 'neutral'} label={t(`admin.reports.status.${r.status}`)} />
          </View>
          <Text style={styles.sub}>
            {t(`admin.reports.target.${r.target_type}`)} · {t(`report.reasons.${r.reason}`)} · {when(r.created_at)}
          </Text>
          <Text style={styles.sub}>{t('admin.reports.by', { name: r.reporter_name ?? t('admin.users.noName') })}</Text>
          {r.details ? <Text style={styles.body}>{r.details}</Text> : null}
          {r.admin_note ? <Text style={styles.sub}>{r.admin_note}</Text> : null}
          {r.status === 'open' ? (
            <View style={styles.actions}>
              <ReasonAction
                label={t('admin.reports.actioned')}
                confirmLabel={t('admin.reports.actionedConfirm')}
                placeholder={t('admin.reports.note')}
                variant="dark"
                onSubmit={async (note) => {
                  const result = await closeReport(r.id, 'actioned', note);
                  if (result.ok) await list.reload();
                  return result.ok;
                }}
              />
              <Button variant="outline" title={t('admin.reports.dismiss')} onPress={() => void dismiss(r.id)} loading={busy === r.id} />
            </View>
          ) : null}
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
  body: { ...type.body, color: colors.text },
  actions: { gap: 8 },
});
