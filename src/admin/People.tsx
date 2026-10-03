import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { StatusChip } from '@/components/StatusChip';
import {
  fetchFlaggedMessages,
  fetchUserDetail,
  fetchUsers,
  setSuspended,
  type AdminUser,
  type AdminUserDetail,
  type FlaggedMessage,
} from '@/lib/admin';
import { sanitizeSearch } from '@/lib/jobs';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, type } from '@/theme';

import { Empty, ErrorLine, Field, Loading, LoadMore, ReasonAction, useWhen, usePaged } from './ui';

function UserDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const when = useWhen();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [failed, setFailed] = useState(false);

  const load = () => fetchUserDetail(id).then((r) => (r.ok ? setDetail(r.data) : setFailed(true)));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (failed) return <ErrorLine text={t('admin.failed')} />;
  if (!detail) return <Loading />;

  const suspend = async (reason: string) => {
    const r = await setSuspended(id, true, reason);
    if (r.ok) {
      await load();
      onChanged();
    }
    return r.ok;
  };
  const restore = async () => {
    const r = await setSuspended(id, false, '');
    if (r.ok) {
      await load();
      onChanged();
    }
    return r.ok;
  };

  return (
    <View style={styles.detail}>
      <Field label={t('admin.users.email')} value={detail.email ?? '—'} />
      <Field label={t('admin.users.joined')} value={when(detail.created_at)} />
      <Field label={t('admin.users.activity')} value={t('admin.users.counts', { jobs: detail.jobs, proposals: detail.proposals, asClient: detail.orders_as_client, asFreelancer: detail.orders_as_freelancer })} />
      {detail.freelancer ? (
        <Field label={t('admin.users.freelancer')} value={t('admin.users.rating', { avg: Number(detail.freelancer.rating_avg).toFixed(1), count: detail.freelancer.rating_count, done: detail.freelancer.completed_orders })} />
      ) : null}
      {detail.company ? <Field label={t('admin.users.company')} value={`${detail.company.name} · ${t(`admin.verification.${detail.company.verification_status}`)}`} /> : null}
      <Field label={t('admin.users.flagged')} value={String(detail.flagged_messages)} />
      {detail.suspended_at ? (
        <>
          <Field label={t('admin.users.suspendedWhy')} value={`${detail.suspension_reason ?? ''} · ${when(detail.suspended_at)}`} />
          <RestoreButton onRestore={restore} />
        </>
      ) : detail.is_admin ? null : (
        <ReasonAction label={t('admin.users.suspend')} confirmLabel={t('admin.users.suspendConfirm')} placeholder={t('admin.users.reason')} onSubmit={suspend} />
      )}
    </View>
  );
}

function RestoreButton({ onRestore }: { onRestore: () => Promise<boolean> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  return <Button title={t('admin.users.restore')} loading={busy} onPress={() => { setBusy(true); void onRestore().finally(() => setBusy(false)); }} />;
}

export function Users({ initialSearch = '' }: { initialSearch?: string }) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [text, setText] = useState(initialSearch);
  const [search, setSearch] = useState(sanitizeSearch(initialSearch));
  const [open, setOpen] = useState<string | null>(null);
  const list = usePaged<AdminUser>((offset) => fetchUsers(search, offset), [search]);

  return (
    <View style={styles.wrap}>
      <Input
        label={t('admin.users.search')}
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => setSearch(sanitizeSearch(text))}
        onBlur={() => setSearch(sanitizeSearch(text))}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {list.failed ? <ErrorLine text={t('admin.failed')} /> : null}
      {list.items.map((u) => (
        <Card key={u.id} style={styles.card}>
          <Pressable accessibilityRole="button" onPress={() => setOpen(open === u.id ? null : u.id)} style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.name}>{u.full_name ?? t('admin.users.noName')}{u.id === profile?.id ? ` (${t('admin.users.you')})` : ''}</Text>
              <Text style={styles.sub}>{u.email}</Text>
            </View>
            {u.suspended_at ? <StatusChip tone="danger" label={t('admin.users.suspendedChip')} /> : u.is_admin ? <StatusChip tone="info" label={t('admin.users.adminChip')} /> : u.role ? <StatusChip label={t(`admin.role.${u.role}`)} /> : null}
          </Pressable>
          {open === u.id ? <UserDetail id={u.id} onChanged={() => void list.reload()} /> : null}
        </Card>
      ))}
      {list.loading && list.items.length === 0 ? <Loading /> : null}
      {!list.loading && list.items.length === 0 && !list.failed ? <Empty text={t('admin.nothing')} /> : null}
      <LoadMore more={list.more} loading={list.loading} onPress={() => void list.loadMore()} />
    </View>
  );
}

export function Chats({ openUser }: { openUser: (name: string) => void }) {
  const { t } = useTranslation();
  const when = useWhen();
  const list = usePaged<FlaggedMessage>(() => fetchFlaggedMessages(), []);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sub}>{t('admin.chats.hint')}</Text>
      {list.failed ? <ErrorLine text={t('admin.failed')} /> : null}
      {list.items.map((m) => (
        <Card key={m.id} style={styles.card}>
          <View style={styles.head}>
            <View style={styles.headText}>
              <Text style={styles.name}>{m.sender_name ?? t('admin.users.noName')}</Text>
              <Text style={styles.sub}>{m.violation_types.join(', ')} · {when(m.created_at)}</Text>
            </View>
          </View>
          <Text style={styles.quote}>{m.original_body}</Text>
          <Button variant="outline" title={t('admin.chats.openUser')} onPress={() => openUser(m.sender_name ?? '')} />
        </Card>
      ))}
      {list.loading ? <Loading /> : null}
      {!list.loading && list.items.length === 0 && !list.failed ? <Empty text={t('admin.nothing')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  headText: { flex: 1 },
  name: { ...type.subheading, color: colors.text },
  sub: { ...type.small, color: colors.muted },
  detail: { gap: 10, paddingTop: 4 },
  quote: { ...type.body, color: colors.text, backgroundColor: colors.tintRedSoft, padding: 12, borderRadius: radius.input },
});
