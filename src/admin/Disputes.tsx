import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChips } from '@/components/FilterChips';
import { Input } from '@/components/Input';
import { StatusChip } from '@/components/StatusChip';
import {
  fetchDisputeMessages,
  fetchDisputes,
  isValidReference,
  resolveDispute,
  type AdminDispute,
  type DisputeMessage,
  type Resolution,
} from '@/lib/admin';
import { confirmAction } from '@/lib/confirm';
import { formatINR, toPaise } from '@/lib/money';
import { colors, radius, type } from '@/theme';

import { Empty, ErrorLine, Field, Loading, LoadMore, usePaged, useWhen } from './ui';

function Chat({ id }: { id: string }) {
  const { t } = useTranslation();
  const when = useWhen();
  const [messages, setMessages] = useState<DisputeMessage[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void fetchDisputeMessages(id).then((r) => (r.ok ? setMessages(r.data) : setFailed(true)));
  }, [id]);

  if (messages === null && !failed) return <Loading />;
  if (failed) return <ErrorLine text={t('admin.failed')} />;
  return (
    <View style={styles.chat}>
      <Text style={styles.note}>{t('admin.disputes.chatLogged')}</Text>
      {messages && messages.length === 0 ? <Text style={styles.sub}>{t('admin.disputes.noMessages')}</Text> : null}
      {messages?.map((m) => (
        <View key={m.id} style={[styles.bubble, m.sender_role === 'client' ? styles.client : styles.freelancer]}>
          <Text style={styles.bubbleHead}>
            {m.sender_name} · {t(`admin.role.${m.sender_role}`)} · {when(m.created_at)}
          </Text>
          <Text style={styles.body}>{m.body}</Text>
        </View>
      ))}
    </View>
  );
}

function Decide({ dispute, onDone }: { dispute: AdminDispute; onDone: () => Promise<unknown> }) {
  const { t } = useTranslation();
  const [resolution, setResolution] = useState<Resolution>('release');
  const [refundText, setRefundText] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundPaise = resolution === 'refund' ? dispute.amount_paise : resolution === 'split' ? toPaise(Number.parseFloat(refundText) || 0) : 0;
  const needsReference = refundPaise > 0;

  const submit = () => {
    if (note.trim().length < 5) return setError(t('admin.disputes.noteNeeded'));
    if (resolution === 'split' && (refundPaise < 1 || refundPaise >= dispute.amount_paise)) return setError(t('admin.disputes.splitInvalid'));
    if (needsReference && !isValidReference(reference)) return setError(t('admin.disputes.referenceNeeded'));
    setError(null);
    confirmAction({
      title: t('admin.disputes.confirmTitle'),
      message: t(`admin.disputes.confirm.${resolution}`, { amount: formatINR(refundPaise) }),
      confirmLabel: t('admin.disputes.decide'),
      cancelLabel: t('common.cancel'),
      destructive: false,
      onConfirm: () => {
        setBusy(true);
        void resolveDispute(dispute.id, resolution, refundPaise, needsReference ? reference.trim() : null, note.trim()).then(async (r) => {
          if (r.ok) await onDone();
          else setError(t('admin.failed'));
          setBusy(false);
        });
      },
    });
  };

  return (
    <View style={styles.decide}>
      <FilterChips
        accessibilityLabel={t('admin.disputes.decision')}
        selected={resolution}
        onChange={(value) => setResolution((value as Resolution) ?? 'release')}
        options={(['release', 'refund', 'split'] as const).map((value) => ({ value, label: t(`admin.disputes.resolution.${value}`) }))}
      />
      {resolution === 'split' ? (
        <Input label={t('admin.disputes.refundAmount', { max: formatINR(dispute.amount_paise) })} value={refundText} onChangeText={(v) => setRefundText(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
      ) : null}
      {needsReference ? <Input label={t('admin.disputes.refundReference')} value={reference} onChangeText={setReference} autoCapitalize="characters" autoCorrect={false} /> : null}
      <Input label={t('admin.disputes.note')} value={note} onChangeText={setNote} multiline maxLength={500} />
      <ErrorLine text={error} />
      <Button title={t('admin.disputes.decide')} onPress={submit} loading={busy} />
    </View>
  );
}

export function Disputes() {
  const { t } = useTranslation();
  const when = useWhen();
  const [status, setStatus] = useState<string | null>('open');
  const [chatOpen, setChatOpen] = useState<string | null>(null);
  const list = usePaged<AdminDispute>((offset) => fetchDisputes(status, offset), [status]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sub}>{t('admin.disputes.hint')}</Text>
      <FilterChips
        accessibilityLabel={t('admin.disputes.status')}
        selected={status}
        onChange={setStatus}
        options={[
          { value: 'open', label: t('admin.disputes.open') },
          { value: 'resolved', label: t('admin.disputes.resolved') },
          { value: null, label: t('admin.all') },
        ]}
      />
      {list.failed ? <ErrorLine text={t('admin.failed')} /> : null}
      {list.items.map((d) => (
        <Card key={d.id} style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.name}>{d.title}</Text>
            <StatusChip tone={d.status === 'open' ? 'danger' : 'neutral'} label={t(`admin.disputes.${d.status}`)} />
          </View>
          <Text style={styles.sub}>
            {t('admin.orders.parties', { client: d.client_name ?? '', freelancer: d.freelancer_name ?? '' })} · {formatINR(d.amount_paise)}
          </Text>
          <Text style={styles.sub}>
            {t('admin.disputes.openedBy', { name: d.opened_by_name ?? '', role: t(`admin.role.${d.opened_by_role}`), when: when(d.created_at) })}
          </Text>
          <Text style={styles.quote}>{d.reason}</Text>

          {d.status === 'resolved' ? (
            <>
              <Field label={t('admin.disputes.decision')} value={t(`admin.disputes.resolution.${d.resolution}`)} />
              {d.refund_paise ? <Field label={t('admin.disputes.refunded')} value={`${formatINR(d.refund_paise)} · ${d.refund_reference ?? ''}`} /> : null}
              {d.decision_note ? <Field label={t('admin.disputes.note')} value={d.decision_note} /> : null}
            </>
          ) : (
            <>
              {chatOpen === d.id ? (
                <Chat id={d.id} />
              ) : (
                <Button variant="outline" title={t('admin.disputes.readChat')} onPress={() => setChatOpen(d.id)} />
              )}
              <Decide dispute={d} onDone={list.reload} />
            </>
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
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { ...type.subheading, color: colors.text, flex: 1 },
  sub: { ...type.small, color: colors.muted },
  note: { ...type.small, color: colors.muted, fontStyle: 'italic' },
  body: { ...type.body, color: colors.text },
  quote: { ...type.body, color: colors.text, backgroundColor: colors.tintRedSoft, padding: 12, borderRadius: radius.input },
  chat: { gap: 8 },
  bubble: { padding: 10, borderRadius: radius.input, gap: 2 },
  client: { backgroundColor: colors.tintBlue },
  freelancer: { backgroundColor: colors.background },
  bubbleHead: { ...type.caption, color: colors.muted },
  decide: { gap: 10, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border },
});
