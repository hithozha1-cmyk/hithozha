import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { StatusChip } from '@/components/StatusChip';
import {
  fetchAuditLog,
  fetchCompanyDetail,
  fetchPayoutsDue,
  fetchPendingCompanies,
  isValidReference,
  markPaidOut,
  reviewCompany,
  type AuditEntry,
  type CompanyDetail,
  type PayoutDue,
  type PendingCompany,
} from '@/lib/admin';
import { formatINR } from '@/lib/money';
import { colors, type } from '@/theme';

import { Empty, ErrorLine, Field, Loading, LoadMore, ReasonAction, usePaged, useWhen } from './ui';

function CompanyFull({ id, onReviewed }: { id: string; onReviewed: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchCompanyDetail(id).then((r) => (r.ok && r.data[0] ? setDetail(r.data[0]) : setFailed(true)));
  }, [id]);

  if (failed) return <ErrorLine text={t('admin.failed')} />;
  if (!detail) return <Loading />;

  return (
    <View style={styles.detail}>
      <Text style={styles.note}>{t('admin.verifications.loggedView')}</Text>
      <Field label={t('admin.verifications.gst')} value={detail.gst_number ?? '—'} />
      <Field label={t('admin.verifications.udyam')} value={detail.udyam_number ?? '—'} />
      <Field label={t('admin.verifications.owner')} value={`${detail.owner_name ?? ''} · ${detail.owner_email ?? ''}`} />
      <Field label={t('admin.verifications.business')} value={[detail.industry, detail.team_size, detail.city].filter(Boolean).join(' · ')} />
      {detail.website ? <Field label={t('admin.verifications.website')} value={detail.website} /> : null}
      {detail.linkedin_url ? <Field label="LinkedIn" value={detail.linkedin_url} /> : null}
      {detail.about ? <Field label={t('admin.verifications.about')} value={detail.about} /> : null}
      <Button
        title={t('admin.verifications.approve')}
        loading={busy}
        onPress={() => {
          setBusy(true);
          void reviewCompany(id, 'verified', null).then(async (r) => {
            if (r.ok) await onReviewed();
            setBusy(false);
          });
        }}
      />
      <ReasonAction
        label={t('admin.verifications.reject')}
        confirmLabel={t('admin.verifications.rejectConfirm')}
        placeholder={t('admin.verifications.reason')}
        onSubmit={async (reason) => {
          const r = await reviewCompany(id, 'rejected', reason);
          if (r.ok) await onReviewed();
          return r.ok;
        }}
      />
    </View>
  );
}

export function Verifications() {
  const { t } = useTranslation();
  const when = useWhen();
  const [open, setOpen] = useState<string | null>(null);
  const list = usePaged<PendingCompany>(() => fetchPendingCompanies(), []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sub}>{t('admin.verifications.hint')}</Text>
      {list.failed ? <ErrorLine text={t('admin.failed')} /> : null}
      {list.items.map((c) => (
        <Card key={c.id} style={styles.card}>
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.sub}>{t('admin.verifications.submitted', { owner: c.owner_name ?? '', when: when(c.created_at) })}</Text>
          {c.gst_masked ? <Text style={styles.mono}>GST {c.gst_masked}</Text> : null}
          {c.udyam_masked ? <Text style={styles.mono}>Udyam {c.udyam_masked}</Text> : null}
          {open === c.id ? (
            <CompanyFull
              id={c.id}
              onReviewed={async () => {
                setOpen(null);
                await list.reload();
              }}
            />
          ) : (
            <Button variant="outline" title={t('admin.verifications.review')} onPress={() => setOpen(c.id)} />
          )}
        </Card>
      ))}
      {list.loading ? <Loading /> : null}
      {!list.loading && list.items.length === 0 && !list.failed ? <Empty text={t('admin.nothing')} /> : null}
    </View>
  );
}

export function Payouts() {
  const { t } = useTranslation();
  const when = useWhen();
  const list = usePaged<PayoutDue>(() => fetchPayoutsDue(), []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sub}>{t('admin.payouts.hint')}</Text>
      {list.failed ? <ErrorLine text={t('admin.failed')} /> : null}
      {list.items.map((p) => (
        <Card key={p.order_id} style={styles.card}>
          <Text style={styles.name}>{t('admin.payoutLine', { amount: formatINR(p.earnings_paise), name: p.freelancer_name ?? '' })}</Text>
          <Text style={styles.sub}>{p.title}{p.completed_at ? ` · ${when(p.completed_at)}` : ''}</Text>
          {p.upi_id ? (
            <>
              <Field label={t('admin.payouts.upi')} value={p.upi_id} />
              <Field label={t('admin.payouts.accountName')} value={p.account_name ?? ''} />
            </>
          ) : (
            <StatusChip tone="warning" label={t('admin.payouts.noDetails')} />
          )}
          <ReasonAction
            variant="primary"
            label={t('admin.markPaid')}
            confirmLabel={t('admin.payouts.confirm')}
            placeholder={t('admin.payouts.reference')}
            validate={isValidReference}
            onSubmit={async (reference) => {
              const r = await markPaidOut(p.order_id, reference);
              if (r.ok) await list.reload();
              return r.ok;
            }}
          />
        </Card>
      ))}
      {list.loading ? <Loading /> : null}
      {!list.loading && list.items.length === 0 && !list.failed ? <Empty text={t('admin.nothing')} /> : null}
    </View>
  );
}

export function Audit() {
  const { t } = useTranslation();
  const when = useWhen();
  const list = usePaged<AuditEntry>((offset) => fetchAuditLog(offset), []);
  const reasonOf = (e: AuditEntry) => {
    const { reason, reference } = e.details as { reason?: string; reference?: string };
    return reason ?? reference ?? null;
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.sub}>{t('admin.audit.hint')}</Text>
      {list.failed ? <ErrorLine text={t('admin.failed')} /> : null}
      {list.items.map((e) => (
        <Card key={e.id} style={styles.card}>
          <Text style={styles.name}>{t(`admin.audit.actions.${e.action}`, { defaultValue: e.action })}</Text>
          <Text style={styles.sub}>{e.admin_name} · {when(e.created_at)}</Text>
          <Text style={styles.mono}>{e.target_type} {e.target_id ?? ''}</Text>
          {reasonOf(e) ? <Text style={styles.sub}>{reasonOf(e)}</Text> : null}
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
  detail: { gap: 10, paddingTop: 4 },
  name: { ...type.subheading, color: colors.text },
  sub: { ...type.small, color: colors.muted },
  note: { ...type.small, color: colors.muted, fontStyle: 'italic' },
  mono: { ...type.small, color: colors.text, fontVariant: ['tabular-nums'] },
});
