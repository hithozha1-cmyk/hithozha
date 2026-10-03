import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { CompanyForm } from '@/components/CompanyForm';
import { Screen } from '@/components/Screen';
import {
  EMPTY_COMPANY,
  companyRow,
  companyToFormValues,
  validateCompany,
  type CompanyField,
  type CompanyFormValues,
} from '@/lib/company';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

/** Edits the signed-in user's company, or creates one ("Switch to company"). */
export default function EditCompanyScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, company, updateProfile, refreshProfile } = useAuth();
  const creating = !company;

  const [values, setValues] = useState<CompanyFormValues>(company ? companyToFormValues(company) : EMPTY_COMPANY);
  const [errors, setErrors] = useState<Partial<Record<CompanyField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const save = async () => {
    const found = validateCompany(values);
    setErrors(found);
    if (Object.keys(found).length > 0 || !session) return;

    setFormError(null);
    setSaving(true);
    const row = companyRow(values);

    const { error } = company
      ? await supabase.from('companies').update(row).eq('id', company.id)
      : await supabase.from('companies').insert({ owner_id: session.user.id, ...row });
    if (error) {
      setSaving(false);
      setFormError(t('company.errors.saveFailed'));
      return;
    }

    if (creating) await updateProfile({ client_type: 'company' });
    await refreshProfile();
    setSaving(false);
    goBack();
  };

  return (
    <Screen
      footer={
        <Button
          title={creating ? t('company.edit.create') : t('company.edit.save')}
          onPress={() => void save()}
          loading={saving}
        />
      }
    >
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title}>{creating ? t('company.edit.createTitle') : t('company.edit.editTitle')}</Text>

      <CompanyForm values={values} onChange={setValues} errors={errors} />

      {formError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {formError}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 12, paddingBottom: 18 },
  error: { ...type.small, color: colors.danger, marginTop: 14 },
});
