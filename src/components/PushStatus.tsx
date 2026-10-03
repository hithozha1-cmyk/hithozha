import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { registerForPushDetailed, type PushOutcome } from '@/lib/push';
import { colors, type } from '@/theme';

/** Shows whether this phone can receive notifications, and fixes it with one tap when it can. */
export function PushStatus() {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState<PushOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  if (Platform.OS === 'web') return null;

  const check = async () => {
    setBusy(true);
    setOutcome(await registerForPushDetailed());
    setBusy(false);
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('pushStatus.title')}</Text>
      {outcome ? (
        <Text style={[styles.body, outcome.result === 'registered' && styles.ok]}>
          {t(`pushStatus.${outcome.result}`)}
          {outcome.detail ? ` (${outcome.detail})` : ''}
        </Text>
      ) : (
        <Text style={styles.body}>{t('pushStatus.hint')}</Text>
      )}
      <Button variant="outline" title={t('pushStatus.check')} onPress={() => void check()} loading={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, marginTop: 20 },
  title: { ...type.subheading, color: colors.text },
  body: { ...type.small, color: colors.muted },
  ok: { color: colors.success },
});
