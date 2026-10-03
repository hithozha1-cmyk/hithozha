import { Tabs } from 'expo-router';
import { ClipboardList, House, MessageCircle, Search, User } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon } from '@/components/TabIcon';
import { colors, fonts } from '@/theme';

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 11 },
        tabBarStyle: {
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
          tabBarIcon: ({ color, focused }) => <TabIcon icon={MessageCircle} color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: t('tabs.orders'),
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
