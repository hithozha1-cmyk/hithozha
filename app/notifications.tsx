import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, ChevronLeft } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { announceUnreadChanged, fetchNotifications, markRead, notificationHref, type AppNotification } from '@/lib/notifications';
import { formatINR } from '@/lib/money';
import { colors, radius, type } from '@/theme';

/** Everything that happened on the person's account, newest first. Tapping one opens the right screen. */
export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchNotifications();
    setFailed(result === null);
    setItems(result ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const unread = (items ?? []).filter((n) => !n.read_at).length;

  const when = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const describe = (n: AppNotification) => {
    const d = n.data;
    const params = {
      name: typeof d.name === 'string' ? d.name : '',
      title: typeof d.title === 'string' ? d.title : '',
      rating: typeof d.rating === 'number' ? d.rating : '',
      reference: typeof d.reference === 'string' ? d.reference : '',
      amount: typeof d.amount_paise === 'number' ? formatINR(d.amount_paise) : '',
    };
    return { title: t(`notifications.kinds.${n.kind}.title`), body: t(`notifications.kinds.${n.kind}.body`, params) };
  };

  const open = async (n: AppNotification) => {
    if (!n.read_at) {
      setItems((previous) => (previous ?? []).map((item) => (item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item)));
      void markRead([n.id]).then(announceUnreadChanged);
    }
    const href = notificationHref(n);
    if (href) router.push(href);
  };

  const markAll = async () => {
    setBusy(true);
    if (await markRead()) {
      announceUnreadChanged();
      await load();
    }
    setBusy(false);
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.title}>{t('notifications.title')}</Text>

      {items === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : failed ? (
        <EmptyState icon={Bell} title={t('notifications.errorTitle')} message={t('notifications.errorBody')} />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title={t('notifications.emptyTitle')} message={t('notifications.emptyBody')} />
      ) : (
        <>
          {unread > 0 ? <Button variant="outline" title={t('notifications.markAll')} onPress={() => void markAll()} loading={busy} style={styles.markAll} /> : null}
          <View style={styles.list}>
            {items.map((n) => {
              const { title, body } = describe(n);
              return (
                <Pressable
                  key={n.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}. ${body}`}
                  onPress={() => void open(n)}
                  style={[styles.row, !n.read_at && styles.unread]}
                >
                  {!n.read_at ? <View style={styles.dot} /> : <View style={styles.dotSpace} />}
                  <View style={styles.text}>
                    <Text style={styles.rowTitle}>{title}</Text>
                    <Text style={styles.rowBody}>{body}</Text>
                    <Text style={styles.rowWhen}>{when(n.created_at)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 8, paddingBottom: 12 },
  loader: { marginTop: 40 },
  markAll: { marginBottom: 12 },
  list: { gap: 10 },
  row: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, minHeight: 64 },
  unread: { backgroundColor: colors.tintRedSoft, borderColor: colors.tintRed },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 7 },
  dotSpace: { width: 10 },
  text: { flex: 1, gap: 2 },
  rowTitle: { ...type.label, color: colors.text },
  rowBody: { ...type.body, color: colors.text },
  rowWhen: { ...type.caption, color: colors.muted },
});
