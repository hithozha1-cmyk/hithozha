import { useLocalSearchParams, useRouter } from 'expo-router';
import { Briefcase, Building2, ChevronLeft, ExternalLink, Globe, Layers, MapPin, Users } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/Card';
import { JobCard } from '@/components/JobCard';
import { CompanyLogo } from '@/components/CompanyLogo';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { COMPANY_COLUMNS, type Company } from '@/lib/company';
import { fetchCompanyJobs, type Job } from '@/lib/jobs';
import { supabase } from '@/lib/supabase';
import { colors, type } from '@/theme';

const isWebLink = (value: string) => /^https?:\/\//i.test(value);

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

function LinkRow({ icon, label, url }: { icon: ReactNode; label: string; url: string }) {
  const display = url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  return (
    <InfoRow icon={icon} label={label}>
      <Pressable
        accessibilityRole="link"
        disabled={!isWebLink(url)}
        onPress={() => void Linking.openURL(url)}
        style={styles.linkPress}
      >
        <Text style={styles.link} numberOfLines={1}>
          {display}
        </Text>
        <ExternalLink size={14} color={colors.primary} strokeWidth={2} />
      </Pressable>
    </InfoRow>
  );
}

export default function CompanyPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    let active = true;
    void fetchCompanyJobs(id).then((result) => {
      if (active) setJobs(result ?? []);
    });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from('companies')
      .select(COMPANY_COLUMNS)
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setCompany(error || !data ? null : (data as Company));
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

  if (!company) {
    return (
      <Screen scroll={false}>
        {back}
        <EmptyState icon={Building2} title={t('company.page.notFoundTitle')} message={t('company.page.notFoundBody')} />
      </Screen>
    );
  }

  return (
    <Screen>
      {back}

      <View style={styles.header}>
        <CompanyLogo name={company.name} uri={company.logo_url} size={88} />
        <Text style={styles.name}>{company.name}</Text>
        {company.verification_status === 'verified' ? <VerifiedBadge /> : null}
      </View>

      <Card style={styles.card}>
        <InfoRow icon={<Layers size={18} color={colors.accent} strokeWidth={1.8} />} label={t('company.page.industry')}>
          <Text style={styles.value}>{t(`company.industries.${company.industry}`, { defaultValue: company.industry })}</Text>
        </InfoRow>
        <InfoRow icon={<Users size={18} color={colors.accent} strokeWidth={1.8} />} label={t('company.page.teamSize')}>
          <Text style={styles.value}>{t(`company.teamSizes.${company.team_size}`)}</Text>
        </InfoRow>
        {company.city ? (
          <InfoRow icon={<MapPin size={18} color={colors.accent} strokeWidth={1.8} />} label={t('company.page.city')}>
            <Text style={styles.value}>{t(`cities.${company.city}`, { defaultValue: company.city })}</Text>
          </InfoRow>
        ) : null}
        {company.website ? (
          <LinkRow icon={<Globe size={18} color={colors.accent} strokeWidth={1.8} />} label={t('company.page.website')} url={company.website} />
        ) : null}
        {company.linkedin_url ? (
          <LinkRow icon={<ExternalLink size={18} color={colors.accent} strokeWidth={1.8} />} label={t('company.page.linkedin')} url={company.linkedin_url} />
        ) : null}
      </Card>

      {company.about ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('company.page.about')}</Text>
          <Text style={styles.about}>{company.about}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('company.page.jobs')}</Text>
        {jobs && jobs.length > 0 ? (
          <View style={styles.jobsList}>
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </View>
        ) : jobs ? (
          <Card style={styles.jobsPlaceholder}>
            <Briefcase size={24} color={colors.muted} strokeWidth={1.7} />
            <Text style={styles.jobsTitle}>{t('company.page.jobsEmptyTitle')}</Text>
            <Text style={styles.jobsBody}>{t('company.page.jobsEmptyBody')}</Text>
          </Card>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  name: { ...type.heading, color: colors.text, textAlign: 'center' },
  card: { gap: 16, marginTop: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.tintBlue, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, gap: 2 },
  infoLabel: { ...type.caption, color: colors.muted },
  value: { ...type.bodyStrong, color: colors.text },
  linkPress: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
  link: { ...type.bodyStrong, color: colors.primary, flexShrink: 1 },
  section: { gap: 10, marginTop: 22 },
  sectionTitle: { ...type.subheading, color: colors.text },
  about: { ...type.body, color: colors.text },
  jobsList: { gap: 12 },
  jobsPlaceholder: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  jobsTitle: { ...type.subheading, color: colors.text },
  jobsBody: { ...type.small, color: colors.muted, textAlign: 'center' },
});
