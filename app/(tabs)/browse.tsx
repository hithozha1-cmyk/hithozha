import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Briefcase, Search, SearchX, WifiOff, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { FilterChips, type FilterOption } from '@/components/FilterChips';
import { JobCard } from '@/components/JobCard';
import { Screen } from '@/components/Screen';
import { Select } from '@/components/Select';
import { useCategories } from '@/hooks/useCategories';
import { CITY_KEYS } from '@/lib/cities';
import {
  EMPTY_FILTERS,
  JOB_TYPES,
  fetchOpenJobs,
  hasActiveFilters,
  type Job,
  type JobFilters,
  type JobType,
} from '@/lib/jobs';
import { isClientRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, layout, radius, type } from '@/theme';

const SEARCH_DELAY_MS = 350;

export default function BrowseScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { profile } = useAuth();
  const { categories } = useCategories();
  // Home sends people here with a category or search words already chosen.
  const params = useLocalSearchParams<{ category?: string; q?: string }>();

  const [searchText, setSearchText] = useState(params.q ?? '');
  const [filters, setFilters] = useState<JobFilters>({ ...EMPTY_FILTERS, query: params.q ?? '', category: params.category ?? null });
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);

  // Apply new Home choices when this tab is already open.
  useEffect(() => {
    if (params.category === undefined && params.q === undefined) return;
    setSearchText(params.q ?? '');
    setFilters((current) => ({ ...current, query: params.q ?? '', category: params.category ?? null }));
  }, [params.category, params.q]);

  // Wait a moment after typing before searching.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => (current.query === searchText ? current : { ...current, query: searchText })), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  const load = useCallback(
    async (pullToRefresh = false) => {
      const request = ++latest.current;
      if (pullToRefresh) setRefreshing(true);
      else if (jobs !== null) setSearching(true);
      const result = await fetchOpenJobs(filters);
      // A newer search has started since this one; its answer is the one that counts.
      if (request !== latest.current) return;
      setFailed(result === null);
      if (result) setJobs(result);
      setLoading(false);
      setSearching(false);
      setRefreshing(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters],
  );

  // Runs when the tab appears and again whenever the filters change, so a new job shows up too.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const categoryOptions = useMemo<FilterOption[]>(
    () => [
      { value: null, label: t('browse.allCategories') },
      ...categories.map((c) => ({ value: c.slug, label: i18n.language === 'ta' ? c.name_ta : c.name_en })),
    ],
    [categories, i18n.language, t],
  );
  const typeOptions = useMemo<FilterOption[]>(
    () => [{ value: null, label: t('browse.allTypes') }, ...JOB_TYPES.map((value) => ({ value, label: t(`jobs.types.${value}`) }))],
    [t],
  );
  const cityOptions = useMemo(
    () => [{ value: 'any', label: t('browse.anyCity') }, ...CITY_KEYS.map((key) => ({ value: key, label: t(`cities.${key}`) }))],
    [t],
  );

  const clearAll = () => {
    setSearchText('');
    setFilters(EMPTY_FILTERS);
  };

  const filtered = hasActiveFilters(filters);
  const empty = failed ? (
    <EmptyState icon={WifiOff} title={t('browse.errorTitle')} message={t('common.genericError')} />
  ) : filtered ? (
    <EmptyState icon={SearchX} title={t('browse.noResultsTitle')} message={t('browse.noResultsBody')} />
  ) : (
    <EmptyState icon={Briefcase} title={t('browse.emptyTitle')} message={t('browse.emptyBody')} />
  );

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{t('browse.title')}</Text>

      <View style={styles.search}>
        <Search size={20} color={colors.muted} strokeWidth={1.8} />
        <TextInput
          accessibilityLabel={t('browse.searchPlaceholder')}
          placeholder={t('browse.searchPlaceholder')}
          placeholderTextColor={colors.muted}
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {searchText ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('browse.clearSearch')} onPress={() => setSearchText('')} style={styles.clearSearch}>
            <X size={18} color={colors.muted} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      <FilterChips
        accessibilityLabel={t('browse.categoryLabel')}
        options={categoryOptions}
        selected={filters.category}
        onChange={(value) => setFilters((current) => ({ ...current, category: value }))}
      />
      <FilterChips
        accessibilityLabel={t('browse.typeLabel')}
        options={typeOptions}
        selected={filters.jobType}
        onChange={(value) => setFilters((current) => ({ ...current, jobType: value as JobType | null }))}
      />
      <View style={styles.cityRow}>
        <Select
          placeholder={t('browse.anyCity')}
          label={t('browse.cityLabel')}
          value={filters.city ?? 'any'}
          options={cityOptions}
          onChange={(value) => setFilters((current) => ({ ...current, city: value === 'any' ? null : value }))}
        />
      </View>

      {filtered ? (
        <Pressable accessibilityRole="button" onPress={clearAll} style={styles.clearAll}>
          <Text style={styles.clearAllText}>{t('browse.clear')}</Text>
        </Pressable>
      ) : null}
      {searching ? <ActivityIndicator color={colors.primary} style={styles.searching} /> : null}
    </View>
  );

  return (
    <Screen size="wide" scroll={false} edges={['top']} padded={false}>
      {loading ? (
        <>
          {header}
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        </>
      ) : (
        <FlatList
          data={jobs ?? []}
          keyExtractor={(job) => job.id}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <JobCard job={item} />
            </View>
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.list}
          onRefresh={() => void load(true)}
          refreshing={refreshing}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}
      {!loading && jobs && jobs.length === 0 && !filtered && !failed && isClientRole(profile?.role ?? null) ? (
        <View style={styles.footer}>
          <Button title={t('home.postJob')} onPress={() => router.push('/jobs/new')} />
        </View>
      ) : null}
      {failed && !loading ? (
        <View style={styles.footer}>
          <Button variant="outline" title={t('common.retry')} onPress={() => void load()} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12, paddingTop: 16, paddingBottom: 12 },
  title: { ...type.title, color: colors.text, paddingHorizontal: layout.screenPadding },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    marginHorizontal: layout.screenPadding,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  searchInput: { ...type.small, flex: 1, fontSize: 15, color: colors.text, minHeight: 44 },
  clearSearch: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  cityRow: { paddingHorizontal: layout.screenPadding },
  clearAll: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: layout.screenPadding },
  clearAllText: { ...type.bodyStrong, color: colors.primary },
  searching: { alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, paddingBottom: 24 },
  cardWrap: { paddingHorizontal: layout.screenPadding, paddingBottom: 12 },
  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: 16 },
});
