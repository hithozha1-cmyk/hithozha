import { useFocusEffect, useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, Lock } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { FilterChips } from '@/components/FilterChips';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { fetchMyIdentity, ID_TYPES, pickIdentityPhoto, submitIdentity, type IdentityCheck, type IdType, type PhotoKind, type PhotoResult } from '@/lib/identity';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, type } from '@/theme';

/** A freelancer sends an ID photo and a selfie. An admin checks them, then deletes the photos. */
export default function VerifyIdentityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

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

  const canSubmit = !check || check.status === 'rejected';

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title}>{t('identity.title')}</Text>
      <Text style={styles.body}>{t('identity.intro')}</Text>

      <View style={styles.privacy}>
        <Lock size={18} color={colors.success} strokeWidth={2} />
        <Text style={styles.privacyText}>{t('identity.privacy')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <>
          {check ? (
            <Card style={styles.card}>
              <StatusChip
                tone={check.status === 'verified' ? 'success' : check.status === 'rejected' ? 'danger' : 'info'}
                label={t(`identity.status.${check.status}`)}
              />
              <Text style={styles.body}>{t(`identity.statusBody.${check.status}`)}</Text>
              {check.status === 'rejected' && check.rejection_reason ? <Text style={styles.reason}>{check.rejection_reason}</Text> : null}
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
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 8 },
  body: { ...type.body, color: colors.muted, marginTop: 8 },
  privacy: { flexDirection: 'row', gap: 10, padding: 14, marginTop: 16, borderRadius: radius.card, backgroundColor: colors.successBg },
  privacyText: { ...type.small, color: colors.success, flex: 1 },
  loader: { marginTop: 40 },
  card: { gap: 12, marginTop: 16 },
  label: { ...type.label, color: colors.text },
  hint: { ...type.small, color: colors.muted },
  reason: { ...type.body, color: colors.danger },
  error: { ...type.small, color: colors.danger },
});
