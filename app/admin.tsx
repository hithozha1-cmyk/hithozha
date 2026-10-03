import { Redirect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Categories } from '@/admin/Categories';
import { Overview } from '@/admin/Overview';
import { Identity } from '@/admin/Identity';
import { Chats, Users } from '@/admin/People';
import { Audit, Payouts, Verifications } from '@/admin/Review';
import { Disputes } from '@/admin/Disputes';
import { Jobs, Orders } from '@/admin/Work';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, type } from '@/theme';

const SECTIONS = ['overview', 'users', 'jobs', 'orders', 'disputes', 'identity', 'verifications', 'chats', 'payouts', 'categories', 'audit'] as const;
type Section = (typeof SECTIONS)[number];

const WIDE = 900;

/** The admin panel. Every action behind it is a database function that checks is_admin() itself. */
export default function AdminScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const { width } = useWindowDimensions();
  const [section, setSection] = useState<Section>('overview');
  const [userSearch, setUserSearch] = useState('');
  // Changing this remounts the section so a fresh search or reload starts clean.
  const [version, setVersion] = useState(0);

  if (!isAdmin) return <Redirect href="/" />;

  const wide = width >= WIDE;
  const go = (next: Section) => {
    setSection(next);
    setVersion((v) => v + 1);
  };
  const goToUser = (name: string) => {
    setUserSearch(name);
    go('users');
  };
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const nav = SECTIONS.map((value) => {
    const active = value === section;
    return (
      <Pressable
        key={value}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={() => {
          if (value !== 'users') setUserSearch('');
          go(value);
        }}
        style={[wide ? styles.sideItem : styles.tab, active && styles.active]}
      >
        <Text style={[styles.navText, active && styles.navTextActive]}>{t(`admin.sections.${value}`)}</Text>
      </Pressable>
    );
  });

  const body = (
    <View key={`${section}-${version}`} style={styles.body}>
      <Text style={styles.heading}>{t(`admin.sections.${section}`)}</Text>
      {section === 'overview' && <Overview goTo={go} />}
      {section === 'users' && <Users initialSearch={userSearch} />}
      {section === 'jobs' && <Jobs />}
      {section === 'orders' && <Orders />}
      {section === 'disputes' && <Disputes />}
      {section === 'identity' && <Identity />}
      {section === 'verifications' && <Verifications />}
      {section === 'chats' && <Chats openUser={goToUser} />}
      {section === 'payouts' && <Payouts />}
      {section === 'categories' && <Categories />}
      {section === 'audit' && <Audit />}
    </View>
  );

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.titleRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>{t('admin.title')}</Text>
      </View>

      {wide ? (
        <View style={styles.wideRow}>
          <View style={styles.side} accessibilityRole="tablist">
            {nav}
          </View>
          {body}
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
            {nav}
          </ScrollView>
          {body}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { width: '100%', maxWidth: 1180, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 12 },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text },
  heading: { ...type.heading, color: colors.text, marginBottom: 4 },
  wideRow: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  side: { width: 220, gap: 4 },
  sideItem: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.input },
  // A horizontal ScrollView grows to fill spare height by default, which stretched every tab into a tall oval.
  tabScroll: { flexGrow: 0, flexShrink: 0 },
  tabs: { gap: 8, paddingBottom: 14, alignItems: 'center' },
  tab: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: '#E8E8EF' },
  active: { backgroundColor: colors.night },
  navText: { ...type.label, color: colors.text },
  navTextActive: { color: colors.onDark },
  body: { flex: 1, gap: 12, width: '100%' },
});
