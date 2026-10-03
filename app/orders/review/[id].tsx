import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Stars } from '@/components/Stars';
import { fetchOrder, submitReview, type Order } from '@/lib/orders';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

/** The client rates a completed order. */
export default function ReviewScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchOrder(id).then((result) => {
      if (!active) return;
      setOrder(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (loading) {
    return (
      <Screen scroll={false}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // Only the client of a completed, not yet reviewed order can be here.
  if (!order || order.client_id !== session?.user.id || order.status !== 'completed' || order.review) {
    return <Redirect href="/" />;
  }

  const submit = async () => {
    if (rating < 1) {
      setError(t('reviews.ratingRequired'));
      return;
    }
    setError(null);
    setSaving(true);
    const result = await submitReview(order.id, rating, comment);
    setSaving(false);
    if (!result.ok) {
      setError(t('reviews.failed'));
      return;
    }
    goBack();
  };

  return (
    <Screen footer={<Button title={t('reviews.submit')} onPress={() => void submit()} loading={saving} />}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>

      <Text style={styles.title}>{t('reviews.title')}</Text>
      <Text style={styles.subtitle}>{t('reviews.subtitle', { name: order.freelancer?.full_name ?? '' })}</Text>

      <View style={styles.stars}>
        <Stars value={rating} onChange={setRating} size={36} />
      </View>

      <Input
        label={t('reviews.commentLabel')}
        placeholder={t('reviews.commentPlaceholder')}
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={1000}
      />

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 12 },
  subtitle: { ...type.body, color: colors.muted, paddingTop: 6 },
  stars: { alignItems: 'center', paddingVertical: 24 },
  error: { ...type.small, color: colors.danger, marginTop: 14 },
});
