import { useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { formatINR } from '@/lib/money';
import { fetchPackages, orderPackage, type ServicePackage } from '@/lib/packages';
import { colors, type } from '@/theme';

/** A freelancer's packages on their public profile, with an "Order" button for other people. */
export function PackageList({ freelancerId, canOrder }: { freelancerId: string; canOrder: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [packages, setPackages] = useState<ServicePackage[] | null>(null);
  const [ordering, setOrdering] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    void fetchPackages(freelancerId).then(setPackages);
  }, [freelancerId]);

  const visible = (packages ?? []).filter((p) => p.active);
  if (packages === null) return <ActivityIndicator color={colors.primary} />;
  if (visible.length === 0) return null;

  const place = async (id: string) => {
    setBusy(true);
    setError(false);
    const result = await orderPackage(id, note);
    setBusy(false);
    if (result.ok) router.push({ pathname: '/orders/[id]', params: { id: result.orderId } });
    else setError(true);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t('packages.title')}</Text>
      {visible.map((p) => (
        <Card key={p.id} style={styles.card}>
          <Text style={styles.name}>{p.title}</Text>
          <Text style={styles.body}>{p.description}</Text>
          <View style={styles.meta}>
            <Text style={styles.price}>{formatINR(p.price_paise)}</Text>
            <View style={styles.days}>
              <Clock size={14} color={colors.muted} strokeWidth={2} />
              <Text style={styles.daysText}>{t('packages.days', { count: p.delivery_days })}</Text>
            </View>
          </View>
          {canOrder ? (
            ordering === p.id ? (
              <View style={styles.order}>
                <Input label={t('packages.note')} value={note} onChangeText={setNote} maxLength={500} multiline />
                <Text style={styles.hint}>{t('packages.orderHint')}</Text>
                {error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {t('packages.orderFailed')}
                  </Text>
                ) : null}
                <Button title={t('packages.confirmOrder', { price: formatINR(p.price_paise) })} onPress={() => void place(p.id)} loading={busy} />
                <Button variant="outline" title={t('common.cancel')} onPress={() => setOrdering(null)} disabled={busy} />
              </View>
            ) : (
              <Button
                title={t('packages.order')}
                onPress={() => {
                  setOrdering(p.id);
                  setError(false);
                }}
              />
            )
          ) : null}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10, marginTop: 22 },
  title: { ...type.subheading, color: colors.text },
  card: { gap: 8 },
  name: { ...type.subheading, color: colors.text },
  body: { ...type.body, color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { ...type.heading, color: colors.primary },
  days: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  daysText: { ...type.small, color: colors.muted },
  order: { gap: 10 },
  hint: { ...type.small, color: colors.muted },
  error: { ...type.small, color: colors.danger },
});
