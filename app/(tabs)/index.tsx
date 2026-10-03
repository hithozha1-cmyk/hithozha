import { useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { NotificationBell } from '@/components/NotificationBell';
import { Screen } from '@/components/Screen';
import { useCategories } from '@/hooks/useCategories';
import { categoryIcon } from '@/lib/categoryIcons';
import { isClientRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, layout, radius, type } from '@/theme';

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { profile, company } = useAuth();
  const { categories, loading, error, reload } = useCategories();
  const [searchText, setSearchText] = useState('');
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? '';
  // Company clients are greeted by their company name.
  const greetingName = profile?.client_type === 'company' && company ? company.name : firstName;

  return (
    <Screen padded={false} edges={['top']}>
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting}>{t('home.greeting', { name: greetingName })}</Text>
            <NotificationBell />
          </View>
          <Text style={styles.headline}>{t('home.headline')}</Text>
        </View>

        <View style={styles.search}>
          <Search size={20} color={colors.muted} strokeWidth={1.8} />
          <TextInput
            accessibilityLabel={t('home.searchPlaceholder')}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={colors.muted}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={() => router.push({ pathname: '/browse', params: { q: searchText.trim() } })}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>

        <Card variant="hero" style={styles.banner}>
          <Text style={styles.bannerTitle}>{t('home.bannerTitle')}</Text>
          <Text style={styles.bannerBody}>{t('home.bannerBody')}</Text>
          {isClientRole(profile?.role ?? null) ? (
            <Button title={t('home.postJob')} onPress={() => router.push('/jobs/new')} style={styles.postJob} />
          ) : null}
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.categories')}</Text>
          {error ? (
            <Pressable accessibilityRole="button" onPress={() => void reload()} style={styles.retry}>
              <Text style={styles.retryText}>{t('home.categoriesError')}</Text>
              <Text style={styles.retryAction}>{t('common.retry')}</Text>
            </Pressable>
          ) : loading ? null : (
            <View style={styles.grid}>
              {categories.map((category, index) => {
                const Icon = categoryIcon(category.icon);
                const red = index % 2 === 0;
                return (
                  <View key={category.id} style={styles.tileCell}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={i18n.language === 'ta' ? category.name_ta : category.name_en}
                      onPress={() => router.push({ pathname: '/browse', params: { category: category.slug } })}
                      style={styles.tile}
                    >
                      <View style={[styles.tileIcon, { backgroundColor: red ? colors.tintRed : colors.tintBlue }]}>
                        <Icon size={24} color={red ? colors.primaryPressed : colors.accent} strokeWidth={1.8} />
                      </View>
                      <Text style={styles.tileLabel} numberOfLines={2}>
                        {i18n.language === 'ta' ? category.name_ta : category.name_en}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: layout.screenPadding, gap: 22 },
  greetingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  header: { gap: 2 },
  greeting: { ...type.body, color: colors.muted },
  headline: { ...type.title, fontSize: 26, color: colors.text },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  searchInput: { ...type.small, flex: 1, fontSize: 15, color: colors.text, minHeight: 44 },
  banner: { gap: 10 },
  postJob: { alignSelf: 'flex-start', minHeight: 44, marginTop: 4 },
  bannerTitle: { ...type.heading, fontSize: 21, lineHeight: 28, color: colors.onDark },
  bannerBody: { ...type.small, lineHeight: 21, color: colors.onDarkMuted },
  section: { gap: 12 },
  sectionTitle: { ...type.subheading, fontSize: 19, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  tileCell: { width: '25%', paddingHorizontal: 4, paddingBottom: 14 },
  tile: { alignItems: 'center', gap: 6 },
  tileIcon: { width: 56, height: 56, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { ...type.caption, color: colors.text, textAlign: 'center' },
  retry: { gap: 4, padding: 16, borderRadius: radius.card, backgroundColor: colors.tintRedSoft, minHeight: 44 },
  retryText: { ...type.small, color: colors.text },
  retryAction: { ...type.label, color: colors.primary },
});
