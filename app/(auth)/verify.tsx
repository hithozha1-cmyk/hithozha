import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { colors, type } from '@/theme';

// Matches the minimum interval between emails configured in Supabase Auth.
const RESEND_SECONDS = 60;

export default function VerifyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = async () => {
    if (!/^\d{6,8}$/.test(code)) {
      setError(t('otp.invalidCode'));
      return;
    }
    setError(null);
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' });
    setBusy(false);
    // On success the session arrives and the auth gate moves on to onboarding.
    if (verifyError) setError(t('otp.wrongCode'));
  };

  const resend = async () => {
    setError(null);
    setBusy(true);
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
    setBusy(false);
    if (resendError) {
      setError(t('otp.sendFailed'));
      return;
    }
    setCode('');
    setCooldown(RESEND_SECONDS);
  };

  const waiting = cooldown > 0 || busy;

  return (
    <Screen footer={<Button title={t('otp.verify')} onPress={() => void verify()} loading={busy} />}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>

      <View style={styles.form}>
        <Text style={styles.title}>{t('otp.title')}</Text>
        <Text style={styles.subtitle}>{t('otp.subtitle', { email })}</Text>
        <Input
          label={t('otp.codeLabel')}
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 8))}
          error={error}
          keyboardType="number-pad"
          maxLength={8}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          style={styles.codeInput}
          autoFocus
        />
        <Pressable accessibilityRole="button" disabled={waiting} onPress={() => void resend()} style={styles.linkButton}>
          <Text style={[styles.link, waiting && styles.linkDisabled]}>
            {cooldown > 0 ? t('otp.resendIn', { seconds: cooldown }) : t('otp.resend')}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.linkButton}>
          <Text style={styles.link}>{t('otp.changeEmail')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  form: { gap: 14, paddingTop: 8 },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.muted, marginBottom: 6 },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  linkButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  link: { ...type.bodyStrong, color: colors.primary },
  linkDisabled: { color: colors.muted },
});
