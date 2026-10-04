import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { colors, type } from '@/theme';

import { startEnrolment, verifyCode, type Enrolment } from './adminAccess';

// The admin site is for one or two people and is shown in English only.

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Screen contentStyle={styles.shell}>
      <Text style={styles.brand}>Hithozha admin</Text>
      <Card style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {children}
      </Card>
    </Screen>
  );
}

export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    // One vague message on purpose: it does not say whether the email exists or the account is an admin.
    if (signInError) setError('Those details did not work.');
    setBusy(false);
  };

  return (
    <Shell title="Sign in">
      <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" />
      <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" onSubmitEditing={() => void submit()} />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Button title="Continue" onPress={() => void submit()} loading={busy} disabled={!email || !password} />
    </Shell>
  );
}

export function NotAdmin({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Shell title="No access">
      <Text style={styles.body}>This account is not an admin account.</Text>
      <Button variant="outline" title="Sign out" onPress={onSignOut} />
    </Shell>
  );
}

/** Asks for the 6-digit code from the authenticator app. */
export function Verify({ factorId, onDone, onSignOut }: { factorId: string; onDone: () => void; onSignOut: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    if (await verifyCode(factorId, code)) onDone();
    else setError('That code did not work. Try the newest code.');
    setBusy(false);
  };

  return (
    <Shell title="Enter your code">
      <Text style={styles.body}>Open your authenticator app and type the 6-digit code for Hithozha admin.</Text>
      <Input label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} onSubmitEditing={() => void submit()} />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Button title="Open admin" onPress={() => void submit()} loading={busy} disabled={code.length !== 6} />
      <Button variant="outline" title="Sign out" onPress={onSignOut} />
    </Shell>
  );
}

/** First time: scan the QR code with an authenticator app, then type a code to prove it works. */
export function Enrol({ onDone, onSignOut }: { onDone: () => void; onSignOut: () => void }) {
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void startEnrolment().then((result) => (result ? setEnrolment(result) : setFailed(true)));
  }, []);

  const submit = async () => {
    if (!enrolment) return;
    setBusy(true);
    setError(null);
    if (await verifyCode(enrolment.factorId, code)) onDone();
    else setError('That code did not work. Try the newest code.');
    setBusy(false);
  };

  return (
    <Shell title="Set up your authenticator">
      <Text style={styles.body}>Admin needs a second step. Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy), then type the 6-digit code it shows.</Text>
      {failed ? <Text style={styles.error}>Could not start the setup. Check that multi-factor (TOTP) is turned on in Supabase.</Text> : null}
      {enrolment ? (
        <>
          <Image source={{ uri: enrolment.qrCode }} style={styles.qr} contentFit="contain" accessibilityLabel="QR code for your authenticator app" />
          <Text style={styles.small}>Cannot scan? Type this key into the app instead:</Text>
          <Text selectable style={styles.secret}>
            {enrolment.secret}
          </Text>
          <Input label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} onSubmitEditing={() => void submit()} />
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Button title="Finish setup" onPress={() => void submit()} loading={busy} disabled={code.length !== 6} />
        </>
      ) : null}
      <Button variant="outline" title="Sign out" onPress={onSignOut} />
    </Shell>
  );
}

const styles = StyleSheet.create({
  shell: { width: '100%', maxWidth: 460, alignSelf: 'center', paddingTop: 48, gap: 16 },
  brand: { ...type.title, color: colors.text, textAlign: 'center' },
  card: { gap: 14 },
  title: { ...type.heading, color: colors.text },
  body: { ...type.body, color: colors.text },
  small: { ...type.small, color: colors.muted },
  secret: { ...type.label, color: colors.text, letterSpacing: 1 },
  error: { ...type.small, color: colors.danger },
  qr: { width: 200, height: 200, alignSelf: 'center', backgroundColor: '#FFFFFF' },
});
