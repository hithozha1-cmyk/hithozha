import { CheckCircle2, Clock, Lock } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChips } from '@/components/FilterChips';
import { StatusChip } from '@/components/StatusChip';
import { fetchMyIdentity, ID_TYPES, pickIdentityPhoto, submitIdentity, type IdentityCheck, type IdType, type PhotoKind, type PhotoResult } from '@/lib/identity';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, type } from '@/theme';

/** How often the waiting screen asks whether an admin has decided. */
const POLL_MS = 20000;

/**
 * Everything about a freelancer's identity check: send the photos, wait for the decision, or
 * read why it was refused. Used on the holding screen after sign-up and on the Profile page.
 */
export function IdentityPanel() {
  const { t } = useTranslation();
  const { session, refreshProfile } = useAuth();
  const userId = session?.user.id;

  const [check, setCheck] = useState<IdentityCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [idType, setIdType] = useState<IdType>('aadhaar');
  const [paths, setPaths] = useState<Partial<Record<PhotoKind, string>>>({});
  const [uploading, setUploading] = useState<PhotoKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setCheck(await fetchMyIdentity(userId));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // While the check is waiting, look for the decision now and then. Once an admin approves,
  // refreshing the profile is what lets the person into the app.
  const waiting = check?.status === 'pending';
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void Promise.all([load(), refreshProfile()]), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load, refreshProfile]);

  const pick = async (kind: PhotoKind) => {
    if (!userId) return;
    setError(null);
    setUploading(kind);
    const result: PhotoResult = await pickIdentityPhoto(kind, userId);
    setUploading(null);
    if (result.status === 'ok') setPaths((previous) => ({ ...previous, [kind]: result.path }));
    else if (result.status === 'denied') setError(t('identity.denied'));
    else if (result.status === 'error') setError(t('identity.uploadFailed'));
  };

  const submit = async () => {
    if (!paths.id || !paths.selfie) return setError(t('identity.bothNeeded'));
    setSubmitting(true);
    setError(null);
    const ok = await submitIdentity(idType, paths.id, paths.selfie);
    if (ok) {
      setPaths({});
      await Promise.all([load(), refreshProfile()]);
    } else {
      setError(t('identity.submitFailed'));
    }
    setSubmitting(false);
  };

  if (loading) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  const canSubmit = !check || check.status === 'rejected';

  return (
    <View style={styles.wrap}>
      <View style={styles.privacy}>
        <Lock size={18} color={colors.success} strokeWidth={2} />
        <Text style={styles.privacyText}>{t('identity.privacy')}</Text>
      </View>

      {check ? (
        <Card style={styles.card}>
          <View style={styles.statusRow}>
            {check.status === 'pending' ? <Clock size={18} color={colors.accent} strokeWidth={2} /> : null}
            <StatusChip tone={check.status === 'verified' ? 'success' : check.status === 'rejected' ? 'danger' : 'info'} label={t(`identity.status.${check.status}`)} />
          </View>
          <Text style={styles.body}>{t(`identity.statusBody.${check.status}`)}</Text>
          {check.status === 'pending' ? <Text style={styles.hint}>{t('identity.emailPromise')}</Text> : null}
          {check.status === 'rejected' ? (
            <>
              {check.rejection_reason ? <Text style={styles.reason}>{check.rejection_reason}</Text> : null}
              <Text style={styles.hint}>{t('identity.emailedRejected')}</Text>
            </>
          ) : null}
        </Card>
      ) : null}

      {canSubmit ? (
        <Card style={styles.card}>
          <Text style={styles.label}>{t('identity.idType')}</Text>
          <FilterChips
            accessibilityLabel={t('identity.idType')}
            selected={idType}
            onChange={(value) => setIdType((value as IdType) ?? 'aadhaar')}
            options={ID_TYPES.map((value) => ({ value, label: t(`identity.types.${value}`) }))}
          />
          <Text style={styles.hint}>{t('identity.idHint')}</Text>
          <Button
            variant="outline"
            title={paths.id ? t('identity.idDone') : t('identity.idPick')}
            icon={paths.id ? <CheckCircle2 size={20} color={colors.success} strokeWidth={2} /> : undefined}
            onPress={() => void pick('id')}
            loading={uploading === 'id'}
          />
          <Text style={styles.hint}>{t('identity.selfieHint')}</Text>
          <Button
            variant="outline"
            title={paths.selfie ? t('identity.selfieDone') : t('identity.selfiePick')}
            icon={paths.selfie ? <CheckCircle2 size={20} color={colors.success} strokeWidth={2} /> : undefined}
            onPress={() => void pick('selfie')}
            loading={uploading === 'selfie'}
          />
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Button title={t('identity.submit')} onPress={() => void submit()} loading={submitting} disabled={!paths.id || !paths.selfie} />
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16, marginTop: 16 },
  loader: { marginTop: 40 },
  privacy: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.card, backgroundColor: colors.successBg },
  privacyText: { ...type.small, color: colors.success, flex: 1 },
  card: { gap: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { ...type.label, color: colors.text },
  body: { ...type.body, color: colors.text },
  hint: { ...type.small, color: colors.muted },
  reason: { ...type.body, color: colors.danger },
  error: { ...type.small, color: colors.danger },
});
