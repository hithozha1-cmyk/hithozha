import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { colors, radius, type } from '@/theme';

type ReasonProps = {
  label: string;
  confirmLabel: string;
  placeholder: string;
  /** Receives the typed text; resolves true when it worked. */
  onSubmit: (text: string) => Promise<boolean>;
  validate?: (text: string) => boolean;
  variant?: 'primary' | 'outline' | 'dark';
};

/** A button that opens a small box asking for a reason (or a reference number) before it does anything. */
export function ReasonAction({ label, confirmLabel, placeholder, onSubmit, validate, variant = 'outline' }: ReasonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = validate ? validate(text) : text.trim().length >= 3;

  if (!open) return <Button variant={variant} title={label} onPress={() => setOpen(true)} />;

  const submit = async () => {
    if (!valid) {
      setError(t('admin.needText'));
      return;
    }
    setBusy(true);
    setError(null);
    const ok = await onSubmit(text.trim());
    setBusy(false);
    if (ok) {
      setOpen(false);
      setText('');
    } else {
      setError(t('admin.failed'));
    }
  };

  return (
    <View style={styles.reason}>
      <Input label={placeholder} value={text} onChangeText={setText} maxLength={200} autoFocus />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button title={confirmLabel} onPress={() => void submit()} loading={busy} />
      <Button variant="outline" title={t('common.cancel')} onPress={() => setOpen(false)} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  error: { ...type.small, color: colors.danger },
  reason: { gap: 10, padding: 12, borderRadius: radius.input, backgroundColor: colors.background },
});
