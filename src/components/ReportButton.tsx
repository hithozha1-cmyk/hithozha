import { Flag } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { FilterChips } from '@/components/FilterChips';
import { Input } from '@/components/Input';
import { REPORT_REASONS, submitReport, type ReportReason } from '@/lib/reports';
import { colors, radius, type } from '@/theme';

/** A quiet "Report" link that opens a small form: why, and an optional note. */
export function ReportButton({ targetType, targetId }: { targetType: 'user' | 'job'; targetId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);

  if (!open) {
    return (
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={styles.link} hitSlop={8}>
        <Flag size={16} color={colors.muted} strokeWidth={2} />
        <Text style={styles.linkText}>{t(`report.open.${targetType}`)}</Text>
      </Pressable>
    );
  }

  const send = async () => {
    if (!reason) return setMessage({ text: t('report.pickReason'), good: false });
    setBusy(true);
    setMessage(null);
    const outcome = await submitReport(targetType, targetId, reason, details);
    setBusy(false);
    if (outcome === 'sent' || outcome === 'duplicate') {
      setOpen(false);
      setReason(null);
      setDetails('');
      setMessage({ text: t(outcome === 'sent' ? 'report.sent' : 'report.duplicate'), good: true });
    } else {
      setMessage({ text: t(outcome === 'limit' ? 'report.limit' : 'report.failed'), good: false });
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('report.title')}</Text>
      <FilterChips
        accessibilityLabel={t('report.title')}
        selected={reason}
        onChange={(value) => setReason((value as ReportReason | null) ?? null)}
        options={REPORT_REASONS.map((value) => ({ value, label: t(`report.reasons.${value}`) }))}
      />
      <Input label={t('report.details')} value={details} onChangeText={setDetails} maxLength={500} multiline />
      {message ? (
        <Text accessibilityRole="alert" style={[styles.message, message.good ? styles.good : styles.bad]}>
          {message.text}
        </Text>
      ) : null}
      <Button title={t('report.send')} onPress={() => void send()} loading={busy} disabled={!reason} />
      <Button variant="outline" title={t('common.cancel')} onPress={() => setOpen(false)} disabled={busy} />
    </View>
  );
}

/** Shown after a report is sent, in the place where the button was. */
export function ReportNotice({ text }: { text: string }) {
  return <Text style={[styles.message, styles.good]}>{text}</Text>;
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' },
  linkText: { ...type.small, color: colors.muted },
  box: { gap: 10, padding: 14, borderRadius: radius.card, backgroundColor: colors.card },
  title: { ...type.subheading, color: colors.text },
  message: { ...type.small },
  good: { color: colors.success },
  bad: { color: colors.danger },
});
