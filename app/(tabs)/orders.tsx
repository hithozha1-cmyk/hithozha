import { useFocusEffect } from 'expo-router';
import { ClipboardList, WifiOff } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { OrderCard } from '@/components/OrderCard';
import { Screen } from '@/components/Screen';
import { fetchOrders, type Order } from '@/lib/orders';
import { useAuth } from '@/providers/AuthProvider';
import { colors, layout, type } from '@/theme';

export default function OrdersScreen() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const userId = session?.user.id ?? '';
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    const result = await fetchOrders();
    setFailed(result === null);
    if (result) setOrders(result);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const empty = failed ? (
    <EmptyState icon={WifiOff} title={t('orders.errorTitle')} message={t('common.genericError')} />
  ) : (
    <EmptyState icon={ClipboardList} title={t('orders.emptyTitle')} message={t('orders.emptyBody')} />
  );

  return (
    <Screen scroll={false} edges={['top']} padded={false}>
      <Text style={styles.title}>{t('tabs.orders')}</Text>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders ?? []}
          keyExtractor={(order) => order.id}
          renderItem={({ item }) => <OrderCard order={item} userId={userId} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.list}
          onRefresh={() => void load(true)}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: colors.text, paddingHorizontal: layout.screenPadding, paddingTop: 16, paddingBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, paddingHorizontal: layout.screenPadding, paddingBottom: 24 },
  separator: { height: 12 },
});
