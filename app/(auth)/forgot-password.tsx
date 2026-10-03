import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

// Matches the minimum interval between emails configured in Supabase Auth.
const RESEND_SECONDS = 60;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Reset a forgotten password: ask for a code by email, then enter the code and a
 * new password. Verifying the code signs the person in, so the app is told to
 * stay on this screen (recovery mode) until the new password has been saved.
 */
export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { beginRecovery, completeRecovery } = useAuth();

  const [stage, setStage] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Once the code has been accepted it cannot be used again, so a retry only saves the password.
  const [codeAccepted, setCodeAccepted] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Leaving this screen ends recovery mode, so nobody is left stuck outside the app.
  useEffect(() => completeRecovery, [completeRecovery]);

  const sendCode = async () => {
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setError(null);
    setBusy(true);
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(address);
    setBusy(false);
    if (sendError) {
      setError(t('otp.sendFailed'));
      return;
    }
    setEmail(address);
    setCode('');
    setCooldown(RESEND_SECONDS);
    setStage('reset');
  };

  const reset = async () => {
    if (!codeAccepted && !/^\d{6,8}$/.test(code)) {
      setError(t('otp.invalidCode'));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.passwordTooShort', { count: MIN_PASSWORD_LENGTH }));
      return;
    }
    setError(null);
    setBusy(true);

    if (!codeAccepted) {
      // Must be on before verifying: that call signs the person in.
      beginRecovery();
      const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
      if (verifyError) {
        completeRecovery();
        setBusy(false);
        setError(t('otp.wrongCode'));
        return;
      }
      setCodeAccepted(true);
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(t('forgot.resetFailed'));
      return;
    }
    // Password saved: let the app carry on as signed in.
    completeRecovery();
  };

  const goBack = () => {
    if (stage === 'reset' && !codeAccepted) {
      setStage('email');
      setError(null);
    } else {
      router.back();
    }
  };

  const waiting = cooldown > 0 || busy;

  return (
    <Screen
      footer={
        stage === 'email' ? (
          <Button title={t('forgot.sendCode')} onPress={() => void sendCode()} loading={busy} />
        ) : (
          <Button title={t('forgot.reset')} onPress={() => void reset()} loading={busy} />
        )
      }
    >
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>

      {stage === 'email' ? (
        <View style={styles.form}>
          <Text style={styles.title}>{t('forgot.title')}</Text>
          <Text style={styles.subtitle}>{t('forgot.subtitle')}</Text>
          <Input
            label={t('auth.emailLabel')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void sendCode()}
            autoFocus
          />
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.title}>{t('forgot.sentTitle')}</Text>
          <Text style={styles.subtitle}>{t('forgot.sentSubtitle', { email })}</Text>
          {!codeAccepted ? (
            <Input
              label={t('otp.codeLabel')}
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              maxLength={8}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              style={styles.codeInput}
              autoFocus
            />
          ) : null}
          <Input
            label={t('forgot.newPassword')}
            placeholder={t('forgot.newPasswordPlaceholder', { count: MIN_PASSWORD_LENGTH })}
            value={password}
            onChangeText={setPassword}
            error={error}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void reset()}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                onPress={() => setShowPassword((value) => !value)}
                style={styles.eye}
              >
                {showPassword ? <EyeOff size={20} color={colors.muted} strokeWidth={1.8} /> : <Eye size={20} color={colors.muted} strokeWidth={1.8} />}
              </Pressable>
            }
          />
          {!codeAccepted ? (
            <Pressable accessibilityRole="button" disabled={waiting} onPress={() => void sendCode()} style={styles.linkButton}>
              <Text style={[styles.link, waiting && styles.linkDisabled]}>
                {cooldown > 0 ? t('otp.resendIn', { seconds: cooldown }) : t('otp.resend')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  form: { gap: 14, paddingTop: 8 },
  title: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.muted, marginBottom: 6 },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  linkButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  link: { ...type.bodyStrong, color: colors.primary },
  linkDisabled: { color: colors.muted },
});
