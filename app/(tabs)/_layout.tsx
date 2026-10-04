import { Tabs } from 'expo-router';
import { ClipboardList, House, MessageCircle, Search, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon } from '@/components/TabIcon';
import { useBadges } from '@/hooks/useBadges';
import { useWide } from '@/hooks/useWide';
import { colors, fonts } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const badges = useBadges();
  const wide = useWide();
  const { width } = useWindowDimensions();
  // On a big screen the tabs sit in a bar at the top, lined up with the 1120px content column.
  const gutter = Math.max(0, (width - 1120) / 2);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? 'top' : 'bottom',
        tabBarLabelPosition: wide ? 'beside-icon' : undefined,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.onDark, fontFamily: fonts.bodySemi },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: wide ? 15 : 11 },
        tabBarStyle: wide
          ? {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              borderBottomWidth: 1,
              borderTopWidth: 0,
              height: 64,
              paddingHorizontal: gutter,
            }
          : {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 8 + insets.bottom,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, focused }) => <TabIcon icon={House} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: t('tabs.browse'),
          tabBarIcon: ({ color, focused }) => <TabIcon icon={Search} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages'),
          tabBarBadge: badges.messages > 0 ? badges.messages : undefined,
          tabBarIcon: ({ color, focused }) => <TabIcon icon={MessageCircle} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabs.orders'),
          tabBarBadge: badges.orders > 0 ? badges.orders : undefined,
          tabBarIcon: ({ color, focused }) => <TabIcon icon={ClipboardList} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => <TabIcon icon={User} color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
