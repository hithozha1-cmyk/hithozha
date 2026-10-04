import { Image } from 'expo-image';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChips } from '@/components/FilterChips';
import { StatusChip } from '@/components/StatusChip';
import {
  deleteIdentityPhotos,
  fetchIdentities,
  openIdentityPhotos,
  reviewIdentity,
  type AdminIdentity,
  type IdentityPhotoUrls,
  type IdentityFilter,
} from '@/lib/admin';
import { confirmAction } from '@/lib/confirm';
import { colors, radius, type } from '@/theme';

import { Empty, ErrorLine, Loading, LoadMore, ReasonAction, usePaged, useWhen } from './ui';

function Photos({ id, onReviewed }: { id: string; onReviewed: (emailed: boolean) => Promise<unknown> }) {
  const { t } = useTranslation();
  const [urls, setUrls] = useState<IdentityPhotoUrls | null>(null);
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setOpening(true);
    setFailed(false);
    const result = await openIdentityPhotos(id);
    if (result) setUrls(result);
    else setFailed(true);
    setOpening(false);
  };

  if (!urls) {
    return (
      <View style={styles.stack}>
        <Text style={styles.note}>{t('admin.identity.linkNote')}</Text>
        <ErrorLine text={failed ? t('admin.failed') : null} />
        <Button variant="outline" title={t('admin.identity.show')} onPress={() => void open()} loading={opening} />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.photos}>
        <View style={styles.photoBox}>
          <Text style={styles.label}>{t('admin.identity.aadhaarPhoto')}</Text>
          <Image source={{ uri: urls.aadhaarUrl }} style={styles.photo} contentFit="contain" accessibilityLabel={t('admin.identity.aadhaarPhoto')} />
        </View>
        {urls.panUrl ? (
          <View style={styles.photoBox}>
            <Text style={styles.label}>{t('admin.identity.panPhoto')}</Text>
            <Image source={{ uri: urls.panUrl }} style={styles.photo} contentFit="contain" accessibilityLabel={t('admin.identity.panPhoto')} />
          </View>
        ) : null}
        <View style={styles.photoBox}>
          <Text style={styles.label}>{t('admin.identity.selfie')}</Text>
          <Image source={{ uri: urls.selfieUrl }} style={styles.photo} contentFit="contain" accessibilityLabel={t('admin.identity.selfie')} />
        </View>
      </View>
      <Button
        title={t('admin.identity.approve')}
        loading={busy}
        onPress={() => {
          setBusy(true);
          void reviewIdentity(id, 'verified', null).then(async (r) => {
            if (r.ok) await onReviewed(r.data.emailed);
            setBusy(false);
          });
        }}
      />
      <ReasonAction
        label={t('admin.identity.reject')}
        confirmLabel={t('admin.identity.rejectConfirm')}
        placeholder={t('admin.identity.reason')}
        onSubmit={async (reason) => {
          const r = await reviewIdentity(id, 'rejected', reason);
          if (r.ok) await onReviewed(r.data.emailed);
          return r.ok;
        }}
      />
    </View>
  );
}

export function Identity() {
  const { t } = useTranslation();
  const when = useWhen();
  const [filter, setFilter] = useState<IdentityFilter>('pending');
  const [open, setOpen] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulk, setBulk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; good: boolean } | null>(null);
  const list = usePaged<AdminIdentity>((offset) => fetchIdentities(filter, offset), [filter]);

  const deleteOne = (c: AdminIdentity) =>
    confirmAction({
      title: t('admin.identity.deleteTitle'),
      message: t('admin.identity.deleteBody'),
      confirmLabel: t('admin.identity.delete'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        setBusyId(c.id);
        setError(null);
        void deleteIdentityPhotos(c.id).then(async (ok) => {
          if (!ok) setError(t('admin.failed'));
          await list.reload();
          setBusyId(null);
        });
      },
    });

  const deleteAll = () =>
    confirmAction({
      title: t('admin.identity.deleteAllTitle', { count: list.items.length }),
      message: t('admin.identity.deleteBody'),
      confirmLabel: t('admin.identity.deleteAll'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        setBulk(true);
        setError(null);
        void (async () => {
          let failures = 0;
          for (const c of list.items) if (!(await deleteIdentityPhotos(c.id))) failures += 1;
          if (failures > 0) setError(t('admin.identity.someFailed', { count: failures }));
          await list.reload();
          setBulk(false);
        })();
      },
    });

  return (
    <View style={styles.wrap}>
      <View style={styles.policy}>
        <Trash2 size={18} color={colors.accent} strokeWidth={2} />
        <Text style={styles.policyText}>{t('admin.identity.policy')}</Text>
      </View>
      <FilterChips
        accessibilityLabel={t('admin.identity.filter')}
        selected={filter}
        onChange={(value) => setFilter((value as IdentityFilter) ?? 'pending')}
        options={[
          { value: 'pending', label: t('admin.identity.pending') },
          { value: 'to_delete', label: t('admin.identity.toDelete') },
          { value: 'all', label: t('admin.all') },
        ]}
      />
      {filter === 'to_delete' && list.items.length > 0 ? (
        <Button variant="dark" title={t('admin.identity.deleteAllButton', { count: list.items.length })} onPress={deleteAll} loading={bulk} />
      ) : null}
      <ErrorLine text={error} />
      {notice ? <Text style={notice.good ? styles.good : styles.warn}>{notice.text}</Text> : null}
      {list.failed ? <ErrorLine text={t('admin.failed')} /> : null}
      {list.items.map((c) => (
        <Card key={c.id} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.name}>{c.user_name ?? t('admin.users.noName')}</Text>
            <StatusChip tone={c.status === 'verified' ? 'success' : c.status === 'rejected' ? 'danger' : 'info'} label={t(`admin.identity.${c.status}`)} />
          </View>
          <Text style={styles.sub}>
            {t(`identity.types.${c.id_type}`)} · {when(c.submitted_at)}
          </Text>
          {c.rejection_reason ? <Text style={styles.sub}>{c.rejection_reason}</Text> : null}

          {c.status === 'pending' ? (
            open === c.id ? (
              <Photos
                id={c.id}
                onReviewed={async (emailed) => {
                  setOpen(null);
                  setNotice({ text: emailed ? t('admin.identity.emailSent') : t('admin.identity.emailNotSent'), good: emailed });
                  await list.reload();
                }}
              />
            ) : (
              <Button variant="outline" title={t('admin.identity.review')} onPress={() => setOpen(c.id)} />
            )
          ) : c.files_deleted_at ? (
            <Text style={styles.done}>{t('admin.identity.deletedOn', { when: when(c.files_deleted_at) })}</Text>
          ) : (
            <Button variant="outline" title={t('admin.identity.delete')} icon={<Trash2 size={18} color={colors.text} strokeWidth={2} />} onPress={() => deleteOne(c)} loading={busyId === c.id} disabled={bulk} />
          )}
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
  card: { gap: 10 },
  stack: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { ...type.subheading, color: colors.text, flex: 1 },
  sub: { ...type.small, color: colors.muted },
  note: { ...type.small, color: colors.muted, fontStyle: 'italic' },
  done: { ...type.small, color: colors.success },
  good: { ...type.small, color: colors.success },
  warn: { ...type.small, color: colors.danger },
  label: { ...type.caption, color: colors.muted },
  policy: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.card, backgroundColor: colors.tintBlue },
  policyText: { ...type.small, color: colors.accent, flex: 1 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoBox: { flexGrow: 1, flexBasis: 240, gap: 4 },
  photo: { width: '100%', height: 280, borderRadius: radius.input, backgroundColor: colors.background },
});
