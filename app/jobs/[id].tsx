import { useLocalSearchParams, useRouter } from 'expo-router';
import { Briefcase, ChevronLeft, Clock, Layers, MapPin, Wallet } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CompanyLogo } from '@/components/CompanyLogo';
import { EmptyState } from '@/components/EmptyState';
import { JobProposalPanel } from '@/components/JobProposalPanel';
import { ReportButton } from '@/components/ReportButton';
import { Screen } from '@/components/Screen';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useCategories } from '@/hooks/useCategories';
import { confirmAction } from '@/lib/confirm';
import { budgetRange, fetchJob, isRecurring, posterName, type Job } from '@/lib/jobs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, type } from '@/theme';

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function JobDetailScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const { categories } = useCategories();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void fetchJob(id).then((result) => {
      if (!active) return;
      setJob(result);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={goBack} style={styles.back}>
      <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
    </Pressable>
  );

  if (loading) {
    return (
      <Screen scroll={false}>
        {back}
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (!job) {
    return (
      <Screen scroll={false}>
        {back}
        <EmptyState icon={Briefcase} title={t('jobs.detail.notFoundTitle')} message={t('jobs.detail.notFoundBody')} />
      </Screen>
    );
  }

  const isOwner = session?.user.id === job.client_id;
  const name = posterName(job);
  const category = categories.find((c) => c.slug === job.category_slug);
  const categoryName = category ? (i18n.language === 'ta' ? category.name_ta : category.name_en) : job.category_slug;
  const recurring = isRecurring(job.job_type);
  const location =
    job.work_mode === 'in_person' && job.city
      ? `${t('jobs.modes.in_person')}, ${t(`cities.${job.city}`, { defaultValue: job.city })}`
      : t('jobs.modes.online');
  const posted = new Date(job.created_at).toLocaleDateString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const close = () =>
    confirmAction({
      title: t('jobs.detail.closeTitle'),
      message: t('jobs.detail.closeBody'),
      confirmLabel: t('jobs.detail.closeAction'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        setActionError(null);
        setClosing(true);
        void supabase
          .from('jobs')
          .update({ status: 'closed' })
          .eq('id', job.id)
          .then(({ error }) => {
            setClosing(false);
            if (error) setActionError(t('jobs.detail.closeFailed'));
            else setJob({ ...job, status: 'closed' });
          });
      },
    });

  const poster = (
    <View style={styles.poster}>
      {job.company ? (
        <CompanyLogo name={job.company.name} uri={job.company.logo_url} size={48} />
      ) : (
        <Avatar name={name} uri={job.client?.avatar_url} size={48} />
      )}
      <View style={styles.posterText}>
        <Text style={styles.posterLabel}>{t('jobs.detail.postedBy')}</Text>
        <Text style={styles.posterName} numberOfLines={1}>
          {name}
        </Text>
        {job.company?.verification_status === 'verified' ? <VerifiedBadge /> : null}
      </View>
    </View>
  );

  return (
    <Screen footer={isOwner && job.status === 'open' ? <Button variant="outline" title={t('jobs.detail.closeAction')} onPress={close} loading={closing} /> : undefined}>
      {back}

      {job.company ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={job.company.name}
          onPress={() => router.push({ pathname: '/company/[id]', params: { id: job.company!.id } })}
        >
          {poster}
        </Pressable>
      ) : (
        poster
      )}

      <Text style={styles.title}>{job.title}</Text>

      <View style={styles.chips}>
        <View style={[styles.chip, { backgroundColor: colors.tintBlue }]}>
          <Text style={[styles.chipText, { color: colors.accent }]}>{t(`jobs.types.${job.job_type}`)}</Text>
        </View>
        {job.status === 'closed' ? (
          <View style={[styles.chip, { backgroundColor: '#E8E8EF' }]}>
            <Text style={[styles.chipText, { color: colors.muted }]}>{t('jobs.detail.closed')}</Text>
          </View>
        ) : null}
      </View>

      <Card style={styles.card}>
        <InfoRow
          icon={<Wallet size={18} color={colors.accent} strokeWidth={1.8} />}
          label={recurring ? t('jobs.detail.monthlyBudget') : t('jobs.detail.budget')}
          value={recurring ? t('jobs.perMonth', { range: budgetRange(job) }) : budgetRange(job)}
        />
        {job.job_type === 'part_time' && job.hours_per_week ? (
          <InfoRow
            icon={<Clock size={18} color={colors.accent} strokeWidth={1.8} />}
            label={t('jobs.post.hours')}
            value={t('jobs.detail.hoursValue', { count: job.hours_per_week })}
          />
        ) : null}
        <InfoRow icon={<Layers size={18} color={colors.accent} strokeWidth={1.8} />} label={t('jobs.detail.category')} value={categoryName} />
        <InfoRow icon={<MapPin size={18} color={colors.accent} strokeWidth={1.8} />} label={t('jobs.detail.location')} value={location} />
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('jobs.detail.about')}</Text>
        <Text style={styles.description}>{job.description}</Text>
        <Text style={styles.posted}>{t('jobs.detail.postedOn', { date: posted })}</Text>
      </View>

      <JobProposalPanel job={job} />

      {actionError ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {actionError}
        </Text>
      ) : null}
      {!isOwner ? <ReportButton targetType="job" targetId={job.id} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  poster: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, minHeight: 56 },
  posterText: { flex: 1, gap: 2 },
  posterLabel: { ...type.caption, color: colors.muted },
  posterName: { ...type.subheading, color: colors.text },
  title: { ...type.title, color: colors.text, paddingTop: 8 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  chipText: { ...type.caption },
  card: { gap: 16, marginTop: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.tintBlue, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { ...type.caption, color: colors.muted },
  infoValue: { ...type.bodyStrong, color: colors.text },
  section: { gap: 10, marginTop: 22 },
  sectionTitle: { ...type.subheading, color: colors.text },
  description: { ...type.body, color: colors.text },
  posted: { ...type.small, color: colors.muted },
  error: { ...type.small, color: colors.danger, marginTop: 14 },
});
