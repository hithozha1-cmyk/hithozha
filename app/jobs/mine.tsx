import { useFocusEffect, useRouter } from 'expo-router';
import { Briefcase, ChevronLeft, WifiOff } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { StatusChip } from '@/components/StatusChip';
import { budgetRange, fetchMyJobs, isRecurring, type MyJob } from '@/lib/jobs';
import { useAuth } from '@/providers/AuthProvider';
import { colors, layout, radius, type } from '@/theme';

/** Every job this person has posted, with how many proposals are waiting on each. */
export default function MyJobsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const [jobs, setJobs] = useState<MyJob[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const result = await fetchMyJobs(session.user.id);
    setFailed(result === null);
    if (result) setJobs(result);
    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const empty = failed ? (
    <EmptyState icon={WifiOff} title={t('myJobs.errorTitle')} message={t('common.genericError')} />
  ) : (
    <EmptyState icon={Briefcase} title={t('myJobs.emptyTitle')} message={t('myJobs.emptyBody')} />
  );

  return (
    <Screen
      scroll={false}
      padded={false}
      footer={<View style={styles.footer}><Button title={t('home.postJob')} onPress={() => router.push('/jobs/new')} /></View>}
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>{t('myJobs.title')}</Text>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={jobs ?? []}
          keyExtractor={(job) => job.id}
          ListEmptyComponent={empty}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const waiting = item.proposals?.[0]?.count ?? 0;
            const range = budgetRange(item);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: item.id } })}
                style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.background }]}
              >
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.chips}>
                  <StatusChip label={t(`myJobs.status.${item.status}`)} tone={item.status === 'open' ? 'success' : 'neutral'} />
                  {waiting > 0 ? <StatusChip label={t('myJobs.waiting', { count: waiting })} tone="warning" /> : null}
                  <StatusChip label={t(`jobs.types.${item.job_type}`)} tone="info" />
                </View>
                <Text style={styles.budget}>{isRecurring(item.job_type) ? t('jobs.perMonth', { range }) : range}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flexGrow: 1, padding: layout.screenPadding },
  separator: { height: 12 },
  card: { gap: 10, padding: 16, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  cardTitle: { ...type.subheading, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  budget: { ...type.bodyStrong, color: colors.primaryPressed },
  footer: { paddingHorizontal: layout.screenPadding },
});
