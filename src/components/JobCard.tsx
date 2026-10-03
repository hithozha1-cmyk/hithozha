import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { CompanyLogo } from '@/components/CompanyLogo';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { budgetRange, isRecurring, posterName, type Job } from '@/lib/jobs';
import { colors, radius, type } from '@/theme';

export function JobCard({ job }: { job: Job }) {
  const { t } = useTranslation();
  const router = useRouter();
  const name = posterName(job);
  const range = budgetRange(job);
  const location =
    job.work_mode === 'in_person' && job.city ? t(`cities.${job.city}`, { defaultValue: job.city }) : t('jobs.modes.online');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={job.title}
      onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: job.id } })}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.poster}>
        {job.company ? (
          <CompanyLogo name={job.company.name} uri={job.company.logo_url} size={40} />
        ) : (
          <Avatar name={name} uri={job.client?.avatar_url} size={40} />
        )}
        <View style={styles.posterText}>
          <Text style={styles.posterName} numberOfLines={1}>
            {name}
          </Text>
          {job.company?.verification_status === 'verified' ? <VerifiedBadge /> : null}
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {job.title}
      </Text>

      <View style={styles.chips}>
        <View style={[styles.chip, styles.typeChip]}>
          <Text style={[styles.chipText, { color: colors.accent }]}>{t(`jobs.types.${job.job_type}`)}</Text>
        </View>
        {job.job_type === 'part_time' && job.hours_per_week ? (
          <View style={[styles.chip, styles.neutralChip]}>
            <Text style={[styles.chipText, { color: colors.muted }]}>{t('jobs.detail.hoursValue', { count: job.hours_per_week })}</Text>
          </View>
        ) : null}
        <View style={[styles.chip, styles.neutralChip]}>
          <MapPin size={12} color={colors.muted} strokeWidth={2} />
          <Text style={[styles.chipText, { color: colors.muted }]}>{location}</Text>
        </View>
      </View>

      <Text style={styles.budget}>{isRecurring(job.job_type) ? t('jobs.perMonth', { range }) : range}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  pressed: { backgroundColor: colors.background },
  poster: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  posterText: { flex: 1, gap: 3 },
  posterName: { ...type.label, color: colors.text },
  title: { ...type.subheading, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  typeChip: { backgroundColor: colors.tintBlue },
  neutralChip: { backgroundColor: '#EDEDF3' },
  chipText: { ...type.caption },
  budget: { ...type.bodyStrong, color: colors.primaryPressed },
});
