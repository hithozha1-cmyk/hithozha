import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { colors, radius, type } from '@/theme';

/** The bell on the Home screen. Shows how many notifications are unread. */
export function NotificationBell() {
  const { t } = useTranslation();
  const router = useRouter();
  const unread = useUnreadNotifications();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? t('notifications.bellUnread', { count: unread }) : t('notifications.title')}
      onPress={() => router.push('/notifications')}
      style={styles.button}
    >
      <Bell size={22} color={colors.text} strokeWidth={1.8} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  badgeText: { ...type.caption, color: colors.onDark },
});
