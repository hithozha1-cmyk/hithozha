import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Select } from '@/components/Select';
import { StatusChip } from '@/components/StatusChip';
import { useCategories } from '@/hooks/useCategories';
import { confirmAction } from '@/lib/confirm';
import { formatINR } from '@/lib/money';
import {
  deletePackage,
  EMPTY_PACKAGE,
  fetchPackages,
  packageToFormValues,
  savePackage,
  setPackageActive,
  validatePackage,
  type PackageField,
  type PackageFormValues,
  type ServicePackage,
} from '@/lib/packages';
import { fetchMyPlan, type MyPlan } from '@/lib/tokens';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

/** A freelancer adds, edits, pauses and deletes their fixed-price packages. */
export default function PackagesScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { profile } = useAuth();
  const { categories } = useCategories();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [values, setValues] = useState<PackageFormValues>(EMPTY_PACKAGE);
  const [errors, setErrors] = useState<Partial<Record<PackageField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; good: boolean } | null>(null);

  const verified = profile?.verification_status === 'verified';

  const load = useCallback(async () => {
    if (!profile) return;
    const list = await fetchPackages(profile.id);
    if (list) setPackages(list);
    setLoaded(true);
  }, [profile]);

  useEffect(() => {
    void load();
    void fetchMyPlan('freelancer').then(setPlan);
  }, [load]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.slug, label: i18n.language === 'ta' ? c.name_ta : c.name_en })),
    [categories, i18n.language],
  );
  const set = <K extends keyof PackageFormValues>(key: K, value: PackageFormValues[K]) => setValues((previous) => ({ ...previous, [key]: value }));
  const error = (field: PackageField) => (errors[field] ? t(errors[field] as string) : null);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const startNew = () => {
    setValues(EMPTY_PACKAGE);
    setErrors({});
    setMessage(null);
    setEditing('new');
  };
  const startEdit = (p: ServicePackage) => {
    setValues(packageToFormValues(p));
    setErrors({});
    setMessage(null);
    setEditing(p.id);
  };

  const save = async () => {
    const result = validatePackage(values);
    setErrors(result.errors);
    if (!result.row) return;
    setSaving(true);
    setMessage(null);
    const outcome = await savePackage(editing === 'new' ? null : editing, result.row);
    setSaving(false);
    if (outcome === 'saved') {
      setEditing(null);
      await load();
    } else {
      setMessage({ text: t(outcome === 'limit' ? 'packages.limit' : 'packages.saveFailed'), good: false });
    }
  };

  const toggle = async (p: ServicePackage) => {
    if (!(await setPackageActive(p.id, !p.active))) setMessage({ text: t('packages.saveFailed'), good: false });
    await load();
  };

  const remove = (p: ServicePackage) =>
    confirmAction({
      title: t('packages.deleteTitle'),
      message: t('packages.deleteBody'),
      confirmLabel: t('packages.delete'),
      cancelLabel: t('common.cancel'),
      destructive: true,
      onConfirm: () => {
        void deletePackage(p.id).then(async (ok) => {
          if (!ok) setMessage({ text: t('packages.saveFailed'), good: false });
          await load();
        });
      },
    });

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.heading}>{t('packages.manageTitle')}</Text>
      <Text style={styles.intro}>{t('packages.manageIntro')}</Text>

      {!verified ? (
        <Card style={styles.card}>
          <Text style={styles.body}>{t('packages.needVerified')}</Text>
          <Button variant="outline" title={t('identity.action')} onPress={() => router.push('/account/verify-identity')} />
        </Card>
      ) : null}

      {message ? (
        <Text accessibilityRole="alert" style={message.good ? styles.good : styles.bad}>
          {message.text}
        </Text>
      ) : null}

      {loaded && packages.length === 0 && editing === null ? <Text style={styles.muted}>{t('packages.none')}</Text> : null}

      {packages.map((p) =>
        editing === p.id ? null : (
          <Card key={p.id} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.name}>{p.title}</Text>
              <StatusChip tone={p.active ? 'success' : 'neutral'} label={t(p.active ? 'packages.live' : 'packages.paused')} />
            </View>
            <Text style={styles.body}>{p.description}</Text>
            <Text style={styles.price}>
              {formatINR(p.price_paise)} · {t('packages.days', { count: p.delivery_days })}
            </Text>
            <View style={styles.actions}>
              <Button variant="outline" title={t('packages.edit')} onPress={() => startEdit(p)} />
              <Button variant="outline" title={t(p.active ? 'packages.pause' : 'packages.resume')} onPress={() => void toggle(p)} />
              <Button variant="outline" title={t('packages.delete')} onPress={() => remove(p)} />
            </View>
          </Card>
        ),
      )}

      {editing !== null ? (
        <Card style={styles.card}>
          <Input label={t('packages.fields.title')} placeholder={t('packages.fields.titlePlaceholder')} value={values.title} onChangeText={(v) => set('title', v)} error={error('title')} maxLength={80} />
          <Select
            label={t('packages.fields.category')}
            placeholder={t('common.select')}
            value={values.category}
            options={categoryOptions}
            onChange={(v) => set('category', v)}
            error={error('category')}
          />
          <Input
            label={t('packages.fields.description')}
            placeholder={t('packages.fields.descriptionPlaceholder')}
            value={values.description}
            onChangeText={(v) => set('description', v)}
            error={error('description')}
            multiline
            maxLength={600}
          />
          <Input label={t('packages.fields.price')} placeholder="1500" value={values.price} onChangeText={(v) => set('price', v.replace(/[^0-9]/g, '').slice(0, 8))} error={error('price')} keyboardType="number-pad" />
          <Input label={t('packages.fields.days')} placeholder="3" value={values.days} onChangeText={(v) => set('days', v.replace(/[^0-9]/g, '').slice(0, 2))} error={error('days')} keyboardType="number-pad" />
          <Text style={styles.muted}>{t('packages.feeNote')}</Text>
          <Button title={t('packages.save')} onPress={() => void save()} loading={saving} />
          <Button variant="outline" title={t('common.cancel')} onPress={() => setEditing(null)} disabled={saving} />
        </Card>
      ) : verified && (plan?.maxPackages == null || packages.length < plan.maxPackages) ? (
        <Button title={t('packages.add')} onPress={startNew} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  heading: { ...type.heading, color: colors.text },
  intro: { ...type.body, color: colors.muted, marginBottom: 12 },
  card: { gap: 10, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { ...type.subheading, color: colors.text, flex: 1 },
  body: { ...type.body, color: colors.text },
  price: { ...type.label, color: colors.primary },
  actions: { gap: 8 },
  muted: { ...type.small, color: colors.muted },
  good: { ...type.small, color: colors.success },
  bad: { ...type.small, color: colors.danger },
});
