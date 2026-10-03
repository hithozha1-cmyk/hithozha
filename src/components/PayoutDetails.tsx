import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { supabase } from '@/lib/supabase';
import { colors, type } from '@/theme';

/** Same rule as the database check on payout_details.upi_id. */
export const UPI_PATTERN = /^[A-Za-z0-9._-]{2,64}@[A-Za-z]{2,32}$/;

/** Where Hithozha should send a freelancer's money. Only the freelancer and admins can read it. */
export function PayoutDetails({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [upi, setUpi] = useState('');
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase
      .from('payout_details')
      .select('upi_id, account_name')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setUpi(data.upi_id);
          setName(data.account_name);
          setSaved(true);
        }
      });
  }, [userId]);

  const save = async () => {
    const cleanUpi = upi.trim();
    const cleanName = name.trim();
    if (!UPI_PATTERN.test(cleanUpi)) return setError(t('earnings.payout.upiInvalid'));
    if (cleanName.length < 2) return setError(t('earnings.payout.nameInvalid'));
    setBusy(true);
    setError(null);
    const { error: saveError } = await supabase.from('payout_details').upsert({ user_id: userId, upi_id: cleanUpi, account_name: cleanName });
    setBusy(false);
    if (saveError) setError(t('common.genericError'));
    else setSaved(true);
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('earnings.payout.title')}</Text>
      <Text style={styles.hint}>{t('earnings.payout.hint')}</Text>
      <Input label={t('earnings.payout.upi')} value={upi} onChangeText={(v) => { setUpi(v); setSaved(false); }} autoCapitalize="none" autoCorrect={false} placeholder="name@bank" />
      <Input label={t('earnings.payout.name')} value={name} onChangeText={(v) => { setName(v); setSaved(false); }} />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {saved ? <Text style={styles.ok}>{t('earnings.payout.saved')}</Text> : null}
      <Button title={t('earnings.payout.save')} onPress={() => void save()} loading={busy} disabled={saved} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  title: { ...type.subheading, color: colors.text },
  hint: { ...type.small, color: colors.muted },
  error: { ...type.small, color: colors.danger },
  ok: { ...type.small, color: colors.success },
});
