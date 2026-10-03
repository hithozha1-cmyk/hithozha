import { useRouter } from 'expo-router';
import { Building2, ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { VerificationChip } from '@/components/VerificationChip';
import { GST_PATTERN, UDYAM_PATTERN } from '@/lib/company';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

const clean = (value: string) => value.trim().toUpperCase();

export default function VerifyBusinessScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { company, refreshProfile } = useAuth();
  const [gst, setGst] = useState('');
  const [udyam, setUdyam] = useState('');
  const [errors, setErrors] = useState<{ gst?: string; udyam?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
      <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
    </Pressable>
  );

  if (!company) {
    return (
      <Screen
        scroll={false}
        footer={<Button title={t('company.edit.createTitle')} onPress={() => router.replace('/company/edit')} />}
      >
        {back}
        <EmptyState icon={Building2} title={t('company.verify.noCompanyTitle')} message={t('company.verify.noCompanyBody')} />
      </Screen>
    );
  }

  const status = company.verification_status;
  const canSubmit = status === 'none' || status === 'rejected';

  const submit = async () => {
    const gstValue = clean(gst);
    const udyamValue = clean(udyam);
    const next: { gst?: string; udyam?: string } = {};
    if (gstValue === '' && udyamValue === '') {
      next.gst = t('company.verify.eitherRequired');
    } else {
      if (gstValue !== '' && !GST_PATTERN.test(gstValue)) next.gst = t('company.verify.gstInvalid');
      if (udyamValue !== '' && !UDYAM_PATTERN.test(udyamValue)) next.udyam = t('company.verify.udyamInvalid');
    }
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    // Users cannot write verification_status; this function moves it to 'pending'.
    const { error } = await supabase.rpc('submit_company_verification', {
      p_gst: gstValue || null,
      p_udyam: udyamValue || null,
    });
    if (error) {
      setSaving(false);
      setFormError(error.code === '23505' ? t('company.verify.duplicate') : t('company.verify.submitFailed'));
      return;
    }
    await refreshProfile();
    setSaving(false);
  };

  return (
    <Screen footer={canSubmit ? <Button title={t('company.verify.submit')} onPress={() => void submit()} loading={saving} /> : undefined}>
      {back}
      <Text style={styles.title}>{t('company.verify.title')}</Text>

      <View style={styles.statusRow}>
        <Text style={styles.statusLabel}>{t('company.verify.statusLabel')}</Text>
        <VerificationChip status={status} />
      </View>

      {canSubmit ? (
        <View style={styles.form}>
          <Text style={styles.subtitle}>{t('company.verify.subtitle')}</Text>
          {status === 'rejected' ? <Text style={styles.rejected}>{t('company.verify.rejectedInfo')}</Text> : null}
          <Input
            label={t('company.verify.gst')}
            placeholder={t('company.verify.gstPlaceholder')}
            value={gst}
            onChangeText={(value) => setGst(value.toUpperCase())}
            error={errors.gst}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={15}
          />
          <Input
            label={t('company.verify.udyam')}
            placeholder={t('company.verify.udyamPlaceholder')}
            value={udyam}
            onChangeText={(value) => setUdyam(value.toUpperCase())}
            error={errors.udyam}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={19}
          />
          <Text style={styles.hint}>{t('company.verify.hint')}</Text>
          {formError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {formError}
            </Text>
          ) : null}
        </View>
      ) : (
        <Card style={styles.info}>
          <Text style={styles.infoText}>
            {status === 'verified' ? t('company.verify.verifiedInfo') : t('company.verify.pendingInfo')}
          </Text>
          {company.gst_number ? (
            <Text style={styles.number}>{t('company.verify.submittedGst', { value: company.gst_number })}</Text>
          ) : null}
          {company.udyam_number ? (
            <Text style={styles.number}>{t('company.verify.submittedUdyam', { value: company.udyam_number })}</Text>
          ) : null}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 12, paddingBottom: 14 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  statusLabel: { ...type.label, color: colors.muted },
  form: { gap: 16 },
  subtitle: { ...type.body, color: colors.muted },
  rejected: { ...type.small, color: colors.danger, backgroundColor: colors.tintRedSoft, padding: 12, borderRadius: 12 },
  hint: { ...type.small, color: colors.muted },
  error: { ...type.small, color: colors.danger },
  info: { gap: 8 },
  infoText: { ...type.bodyStrong, color: colors.text },
  number: { ...type.small, color: colors.muted },
});
