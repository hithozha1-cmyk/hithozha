import { useFocusEffect, useRouter } from 'expo-router';
import { Briefcase, WifiOff } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { JobCard } from '@/components/JobCard';
import { Screen } from '@/components/Screen';
import { fetchOpenJobs, type Job } from '@/lib/jobs';
import { isClientRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, layout, type } from '@/theme';

export default function BrowseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (pullToRefresh = false) => {
    if (pullToRefresh) setRefreshing(true);
    const result = await fetchOpenJobs();
    setFailed(result === null);
    if (result) setJobs(result);
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Reload whenever the tab comes into view, so a job just posted shows up.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const empty = failed ? (
    <EmptyState icon={WifiOff} title={t('browse.errorTitle')} message={t('common.genericError')} />
  ) : (
    <EmptyState icon={Briefcase} title={t('browse.emptyTitle')} message={t('browse.emptyBody')} />
  );

  return (
    <Screen scroll={false} edges={['top']} padded={false}>
      <Text style={styles.title}>{t('browse.title')}</Text>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={jobs ?? []}
          keyExtractor={(job) => job.id}
          renderItem={({ item }) => <JobCard job={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={empty}
          contentContainerStyle={styles.list}
          onRefresh={() => void load(true)}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
        />
      )}
      {failed || (jobs && jobs.length === 0) ? (
        <View style={styles.footer}>
          {failed ? (
            <Button variant="outline" title={t('common.retry')} onPress={() => void load()} />
          ) : isClientRole(profile?.role ?? null) ? (
            <Button title={t('home.postJob')} onPress={() => router.push('/jobs/new')} />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title, color: colors.text, paddingHorizontal: layout.screenPadding, paddingTop: 16, paddingBottom: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, paddingHorizontal: layout.screenPadding, paddingBottom: 24 },
  separator: { height: 12 },
  footer: { paddingHorizontal: layout.screenPadding, paddingBottom: 16 },
});
