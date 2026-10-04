import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { fetchUserTokens, giveTokens, setMembership, type UserTokens } from '@/lib/admin';
import { colors, type } from '@/theme';

import { ErrorLine, Field, useWhen } from './ui';

const PLAN_CODES = ['freelancer_free', 'freelancer_pro', 'freelancer_elite', 'client_free', 'client_business', 'client_startup'] as const;

/** An admin gives a plan or tokens by hand (until payments are live). Every change is audit-logged. */
export function Membership({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const when = useWhen();
  const [info, setInfo] = useState<UserTokens | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [months, setMonths] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<'plan' | 'tokens' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchUserTokens(userId);
    if (result.ok) setInfo(result.data);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPlan = async () => {
    if (!plan) return;
    setBusy('plan');
    setError(null);
    const length = months.trim() === '' ? null : Number(months);
    const r = length !== null && !(Number.isInteger(length) && length >= 1 && length <= 36) ? { ok: false as const } : await setMembership(userId, plan, length);
    if (!r.ok) setError(t('admin.membership.planFailed'));
    else {
      setMonths('');
      await load();
    }
    setBusy(null);
  };

  const gift = async () => {
    const count = Number(amount);
    if (!(Number.isInteger(count) && count >= 1 && count <= 1000) || reason.trim().length < 3) {
      setError(t('admin.membership.giftInvalid'));
      return;
    }
    setBusy('tokens');
    setError(null);
    const r = await giveTokens(userId, count, reason.trim());
    if (!r.ok) setError(t('admin.failed'));
    else {
      setAmount('');
      setReason('');
      await load();
    }
    setBusy(null);
  };

  if (!info) return null;
  const expires = (d: string | null) => (d ? ` · ${t('admin.membership.until', { date: when(d) })}` : '');

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('admin.membership.title')}</Text>
      <Field label={t('admin.membership.tokens')} value={t('admin.membership.tokensValue', { free: info.free, bought: info.bought })} />
      <Field label={t('admin.membership.freelancerPlan')} value={`${t(`admin.membership.plans.${info.freelancer_plan}`)}${expires(info.freelancer_expires)}`} />
      <Field label={t('admin.membership.clientPlan')} value={`${t(`admin.membership.plans.${info.client_plan}`)}${expires(info.client_expires)}`} />

      <Select
        label={t('admin.membership.givePlan')}
        placeholder={t('common.select')}
        value={plan}
        options={PLAN_CODES.map((code) => ({ value: code, label: t(`admin.membership.plans.${code}`) }))}
        onChange={setPlan}
      />
      <Input label={t('admin.membership.months')} value={months} onChangeText={(v) => setMonths(v.replace(/[^0-9]/g, '').slice(0, 2))} keyboardType="number-pad" />
      <Button variant="outline" title={t('admin.membership.applyPlan')} onPress={() => void applyPlan()} loading={busy === 'plan'} disabled={!plan} />

      <Input label={t('admin.membership.giftAmount')} value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, '').slice(0, 4))} keyboardType="number-pad" />
      <Input label={t('admin.membership.giftReason')} value={reason} onChangeText={setReason} maxLength={200} />
      <Button variant="outline" title={t('admin.membership.giveTokens')} onPress={() => void gift()} loading={busy === 'tokens'} />
      <ErrorLine text={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10, marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  title: { ...type.subheading, color: colors.text },
});
