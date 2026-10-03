import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Eye, EyeOff } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { colors, layout, radius, type } from '@/theme';

type Mode = 'signIn' | 'signUp';
type FieldErrors = { email?: string; password?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const [mode, setMode] = useState<Mode>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const goToVerify = (address: string) => router.push({ pathname: '/verify', params: { email: address } });

  const submit = async () => {
    const address = email.trim().toLowerCase();
    const next: FieldErrors = {};
    if (!EMAIL_PATTERN.test(address)) next.email = t('auth.invalidEmail');
    if (mode === 'signUp' ? password.length < MIN_PASSWORD_LENGTH : password.length === 0) {
      next.password = t('auth.passwordTooShort', { count: MIN_PASSWORD_LENGTH });
    }
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      if (mode === 'signUp') {
        // With email confirmation on, no session comes back: the user must verify the emailed code.
        const { error } = await supabase.auth.signUp({ email: address, password });
        if (error) {
          setFormError(error.code === 'weak_password' ? t('auth.passwordTooShort', { count: MIN_PASSWORD_LENGTH }) : t('auth.signUpFailed'));
          return;
        }
        goToVerify(address);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: address, password });
      if (!error) return; // The auth gate takes over once the session arrives.

      if (error.code === 'email_not_confirmed') {
        // Signed up earlier but never verified: send a fresh code.
        const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: address });
        if (resendError) setFormError(t('otp.sendFailed'));
        else goToVerify(address);
        return;
      }
      setFormError(error.code === 'invalid_credentials' ? t('auth.invalidCredentials') : t('auth.signInFailed'));
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
  };

  return (
    <Screen
      padded={false}
      edges={['bottom']}
      contentStyle={styles.content}
      footer={
        <View style={styles.footer}>
          <Button
            title={mode === 'signUp' ? t('auth.createAccount') : t('auth.signIn')}
            onPress={() => void submit()}
            loading={busy}
          />
          <Text style={styles.terms}>{t('welcome.terms')}</Text>
        </View>
      }
    >
      <StatusBar style="light" />
      <View style={styles.hero}>
        <Logo onDark />
        <Text style={styles.greeting}>{t('welcome.greeting')}</Text>
        <Text style={styles.tagline}>{t('welcome.tagline')}</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.tabs} accessibilityRole="tablist">
          {(['signUp', 'signIn'] as const).map((value) => {
            const active = mode === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => switchMode(value)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {value === 'signUp' ? t('auth.createAccount') : t('auth.signIn')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          label={t('auth.emailLabel')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <Input
          ref={passwordRef}
          label={t('auth.passwordLabel')}
          placeholder={mode === 'signUp' ? t('auth.passwordNewPlaceholder', { count: MIN_PASSWORD_LENGTH }) : t('auth.passwordPlaceholder')}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              onPress={() => setShowPassword((value) => !value)}
              style={styles.eye}
            >
              {showPassword ? (
                <EyeOff size={20} color={colors.muted} strokeWidth={1.8} />
              ) : (
                <Eye size={20} color={colors.muted} strokeWidth={1.8} />
              )}
            </Pressable>
          }
        />

        {formError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {formError}
          </Text>
        ) : null}
      </View>

      <View style={styles.language}>
        <Text style={styles.languageTitle}>{t('welcome.chooseLanguage')}</Text>
        <LanguagePicker />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  hero: {
    backgroundColor: colors.night,
    paddingTop: 56,
    paddingBottom: 32,
    paddingHorizontal: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    gap: 14,
  },
  greeting: { ...type.display, color: colors.onDark, marginTop: 8 },
  tagline: { ...type.body, fontSize: 16, color: colors.onDarkMuted },
  form: { paddingHorizontal: layout.screenPadding, paddingTop: 24, gap: 16 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: radius.card, backgroundColor: '#E8E8EF', gap: 4 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  tabActive: { backgroundColor: colors.card },
  tabText: { ...type.label, color: colors.muted },
  tabTextActive: { color: colors.text, fontFamily: type.bodyStrong.fontFamily },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  error: {
    ...type.small,
    color: colors.danger,
    backgroundColor: colors.tintRedSoft,
    borderRadius: radius.input,
    padding: 10,
  },
  language: { paddingHorizontal: layout.screenPadding, paddingTop: 28, gap: 14 },
  languageTitle: { ...type.subheading, color: colors.text },
  footer: { gap: 10, paddingHorizontal: layout.screenPadding },
  terms: { ...type.small, color: colors.muted, textAlign: 'center' },
});
