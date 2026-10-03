import { Redirect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { FreelancerForm } from '@/components/FreelancerForm';
import { Screen } from '@/components/Screen';
import {
  EMPTY_FREELANCER,
  FREELANCER_COLUMNS,
  freelancerToFormValues,
  validateFreelancer,
  type FreelancerField,
  type FreelancerFormValues,
  type FreelancerRow,
} from '@/lib/freelancerForm';
import { supabase } from '@/lib/supabase';
import { isFreelancerRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

/** A freelancer edits the details buyers see: headline, skills, rate, bio, portfolio. */
export default function EditFreelancerScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, profile } = useAuth();
  const userId = session?.user.id;

  const [values, setValues] = useState<FreelancerFormValues>(EMPTY_FREELANCER);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<FreelancerField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void supabase
      .from('freelancer_profiles')
      .select(FREELANCER_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (data) setValues(freelancerToFormValues(data as unknown as FreelancerRow));
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!isFreelancerRole(profile?.role ?? null)) return <Redirect href="/" />;

  const save = async () => {
    const result = validateFreelancer(values);
    setErrors(result.errors);
    if (!result.details || !userId) return;

    setFormError(null);
    setSaving(true);
    const { error } = await supabase
      .from('freelancer_profiles')
      .upsert({ user_id: userId, ...result.details }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) {
      setFormError(t('account.saveFailed'));
      return;
    }
    goBack();
  };

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
      <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
    </Pressable>
  );

  if (loading) {
    return (
      <Screen scroll={false}>
        {back}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title={t('account.save')} onPress={() => void save()} loading={saving} />}>
      {back}
      <Text style={styles.title}>{t('account.freelancerTitle')}</Text>

      <FreelancerForm values={values} onChange={setValues} errors={errors} />

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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 12, paddingBottom: 18 },
  error: { ...type.small, color: colors.danger, marginTop: 18 },
});
