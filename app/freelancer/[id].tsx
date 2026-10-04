import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ExternalLink, Share2, UserX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { PackageList } from '@/components/PackageList';
import { ReportButton } from '@/components/ReportButton';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { useAuth } from '@/providers/AuthProvider';
import { Screen } from '@/components/Screen';
import { Stars } from '@/components/Stars';
import { useCategories } from '@/hooks/useCategories';
import { fetchFreelancer, fetchFreelancerReviews, type FreelancerPage, type FreelancerReview } from '@/lib/freelancers';
import { colors, radius, type } from '@/theme';

function Chips({ items }: { items: string[] }) {
  return (
    <View style={styles.chips}>
      {items.map((item) => (
        <View key={item} style={styles.chip}>
          <Text style={styles.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function FreelancerScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { categories } = useCategories();

  const [freelancer, setFreelancer] = useState<FreelancerPage | null>(null);
  const [reviews, setReviews] = useState<FreelancerReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all([fetchFreelancer(id), fetchFreelancerReviews(id)]).then(([page, list]) => {
      if (!active) return;
      setFreelancer(page);
      setReviews(list ?? []);
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

  const profile = freelancer?.freelancer_profiles;
  if (!freelancer || !profile) {
    return (
      <Screen scroll={false}>
        {back}
        <EmptyState icon={UserX} title={t('freelancer.notFoundTitle')} message={t('freelancer.notFoundBody')} />
      </Screen>
    );
  }

  const skillNames = profile.skills.map((slug) => {
    const category = categories.find((c) => c.slug === slug);
    return category ? (i18n.language === 'ta' ? category.name_ta : category.name_en) : slug;
  });
  const languageNames = profile.languages.map((key) => t(`onboarding.professional.languageNames.${key}`, { defaultValue: key }));
  const dateLocale = i18n.language === 'ta' ? 'ta-IN' : 'en-IN';

  return (
    <Screen>
      {back}

      <View style={styles.header}>
        <Avatar name={freelancer.full_name} uri={freelancer.avatar_url} size={88} />
        <Text style={styles.name}>{freelancer.full_name}</Text>
        {freelancer.verification_status === 'verified' ? <VerifiedBadge /> : null}
        {profile.headline ? <Text style={styles.headline}>{profile.headline}</Text> : null}
        {freelancer.city ? <Text style={styles.city}>{t(`cities.${freelancer.city}`, { defaultValue: freelancer.city })}</Text> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('share.profile')}
        onPress={() => void Share.share({ message: t('share.profileMessage', { name: freelancer.full_name ?? '', url: `https://app.hithozha.in/freelancer/${freelancer.id}` }) })}
        style={styles.shareRow}
      >
        <Share2 size={18} color={colors.primary} strokeWidth={2} />
        <Text style={styles.shareText}>{t('share.profile')}</Text>
      </Pressable>

      <Card style={styles.stats}>
        <View style={styles.stat}>
          {profile.rating_count > 0 ? (
            <>
              <Text style={styles.statValue}>{profile.rating_avg.toFixed(1)}</Text>
              <Stars value={profile.rating_avg} size={14} />
              <Text style={styles.statLabel}>{t('freelancer.ratingCount', { count: profile.rating_count })}</Text>
            </>
          ) : (
            <>
              <Text style={styles.statValue}>{t('proposals.noRatings')}</Text>
              <Text style={styles.statLabel}>{t('freelancer.noReviews')}</Text>
            </>
          )}
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{profile.completed_orders}</Text>
          <Text style={styles.statLabel}>{t('freelancer.completed')}</Text>
        </View>
      </Card>

      {profile.bio ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('freelancer.about')}</Text>
          <Text style={styles.body}>{profile.bio}</Text>
        </View>
      ) : null}

      {skillNames.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('freelancer.services')}</Text>
          <Chips items={skillNames} />
        </View>
      ) : null}

      <View style={styles.section}>
        {profile.experience_level ? (
          <Text style={styles.body}>
            {t('freelancer.experience')}: {t(`onboarding.professional.levels.${profile.experience_level}`)}
          </Text>
        ) : null}
        {profile.availability ? (
          <Text style={styles.body}>
            {t('freelancer.availability')}: {t(`onboarding.professional.availabilityOptions.${profile.availability}`)}
          </Text>
        ) : null}
        {languageNames.length > 0 ? (
          <Text style={styles.body}>
            {t('freelancer.languages')}: {languageNames.join(', ')}
          </Text>
        ) : null}
      </View>

      <PackageList freelancerId={freelancer.id} canOrder={session?.user.id !== freelancer.id} />

      {profile.portfolio_urls.length > 0 || profile.portfolio_website ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('freelancer.portfolio')}</Text>
          {profile.portfolio_website && /^https?:\/\//i.test(profile.portfolio_website) ? (
            <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(profile.portfolio_website as string)} style={styles.websiteRow}>
              <Text style={styles.websiteText} numberOfLines={1}>
                {profile.portfolio_website.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')}
              </Text>
              <ExternalLink size={14} color={colors.primary} strokeWidth={2} />
            </Pressable>
          ) : null}
          <View style={styles.grid}>
            {profile.portfolio_urls.map((url) => (
              <Image key={url} source={{ uri: url }} style={styles.thumb} contentFit="cover" />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('freelancer.reviews')}</Text>
        {reviews.length === 0 ? (
          <Text style={styles.muted}>{t('freelancer.noReviews')}</Text>
        ) : (
          reviews.map((review) => (
            <Card key={review.id} style={styles.review}>
              <View style={styles.reviewTop}>
                <Avatar name={review.reviewer?.full_name} uri={review.reviewer?.avatar_url} size={32} />
                <Text style={styles.reviewer} numberOfLines={1}>
                  {review.reviewer?.full_name}
                </Text>
                <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <Stars value={review.rating} size={14} />
              {review.comment ? <Text style={styles.body}>{review.comment}</Text> : null}
            </Card>
          ))
        )}
      </View>
      {session?.user.id !== freelancer.id ? <ReportButton targetType="user" targetId={freelancer.id} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  shareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44 },
  shareText: { ...type.label, color: colors.primary },
  websiteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  websiteText: { ...type.body, color: colors.primary, flexShrink: 1 },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', gap: 4, paddingVertical: 8 },
  name: { ...type.heading, color: colors.text, marginTop: 8, textAlign: 'center' },
  headline: { ...type.body, color: colors.accent, textAlign: 'center' },
  city: { ...type.small, color: colors.muted },
  stats: { flexDirection: 'row', alignItems: 'stretch', marginTop: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { ...type.heading, color: colors.text },
  statLabel: { ...type.caption, color: colors.muted },
  divider: { width: 1, backgroundColor: colors.border, marginHorizontal: 8 },
  section: { gap: 8, marginTop: 22 },
  sectionTitle: { ...type.subheading, color: colors.text },
  body: { ...type.body, color: colors.text },
  muted: { ...type.small, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.tintBlue },
  chipText: { ...type.label, color: colors.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: { width: 96, height: 96, borderRadius: radius.input, backgroundColor: colors.tintBlue },
  review: { gap: 8 },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewer: { ...type.label, color: colors.text, flex: 1 },
  reviewDate: { ...type.caption, color: colors.muted },
});
