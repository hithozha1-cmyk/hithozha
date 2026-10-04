import { Gift } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { cleanReferralCode, fetchMyReferral, MAX_REWARDED_FRIENDS, REFERRAL_REWARD, redeemReferral, type MyReferral } from '@/lib/referrals';
import { colors, type } from '@/theme';

/** Your referral code to share, and (for new accounts) a box to enter a friend's code. */
export function ReferralCard() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<MyReferral | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);

  const load = useCallback(async () => setInfo(await fetchMyReferral()), []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!info) return null;

  const redeem = async () => {
    setBusy(true);
    setMessage(null);
    const outcome = await redeemReferral(typed);
    setBusy(false);
    setMessage({ text: t(`referral.redeem.${outcome}`, { count: REFERRAL_REWARD }), good: outcome === 'ok' });
    if (outcome === 'ok') {
      setTyped('');
      await load();
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Gift size={20} color={colors.primary} strokeWidth={2} />
        <Text style={styles.title}>{t('referral.title')}</Text>
      </View>
      <Text style={styles.body}>{t('referral.intro', { count: REFERRAL_REWARD })}</Text>
      <Text selectable accessibilityLabel={t('referral.yourCode')} style={styles.code}>
        {info.code}
      </Text>
      <Button
        title={t('referral.share')}
        onPress={() => void Share.share({ message: t('referral.shareMessage', { code: info.code, count: REFERRAL_REWARD }) })}
      />
      <Text style={styles.small}>{t('referral.progress', { friends: info.friends, max: MAX_REWARDED_FRIENDS, bonus: info.bonus })}</Text>

      {info.can_redeem ? (
        <View style={styles.redeem}>
          <Input label={t('referral.haveCode')} value={typed} onChangeText={(v) => setTyped(cleanReferralCode(v))} autoCapitalize="characters" autoCorrect={false} maxLength={6} />
          <Button variant="outline" title={t('referral.apply')} onPress={() => void redeem()} loading={busy} disabled={typed.length !== 6} />
        </View>
      ) : null}
      {message ? (
        <Text accessibilityRole="alert" style={message.good ? styles.good : styles.bad}>
          {message.text}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, marginTop: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...type.subheading, color: colors.text },
  body: { ...type.body, color: colors.text },
  code: { ...type.heading, color: colors.primary, letterSpacing: 4, textAlign: 'center', paddingVertical: 6 },
  small: { ...type.small, color: colors.muted },
  redeem: { gap: 10, marginTop: 6 },
  good: { ...type.small, color: colors.success },
  bad: { ...type.small, color: colors.danger },
});
