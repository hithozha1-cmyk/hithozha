import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { StatusChip, type ChipTone } from '@/components/StatusChip';
import { Stars } from '@/components/Stars';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { formatINR } from '@/lib/money';
import type { Proposal, ProposalStatus } from '@/lib/proposals';
import { colors, type } from '@/theme';

export const PROPOSAL_TONE: Record<ProposalStatus, ChipTone> = {
  pending: 'info',
  accepted: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

type Props = {
  proposal: Proposal;
  /** Action buttons shown under the message. */
  actions?: ReactNode;
};

export function ProposalCard({ proposal, actions }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const person = proposal.freelancer;
  const profile = person?.freelancer_profiles ?? null;

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={person?.full_name ?? ''}
        onPress={() => router.push({ pathname: '/freelancer/[id]', params: { id: proposal.freelancer_id } })}
        style={styles.header}
      >
        <Avatar name={person?.full_name} uri={person?.avatar_url} size={48} />
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>
            {person?.full_name}
          </Text>
          {person?.verification_status === 'verified' ? <VerifiedBadge /> : null}
          {profile?.headline ? (
            <Text style={styles.headline} numberOfLines={1}>
              {profile.headline}
            </Text>
          ) : null}
          <View style={styles.ratingRow}>
            {profile && profile.rating_count > 0 ? (
              <>
                <Stars value={profile.rating_avg} size={13} />
                <Text style={styles.ratingText}>{t('proposals.rating', { rating: profile.rating_avg, count: profile.rating_count })}</Text>
              </>
            ) : (
              <Text style={styles.ratingText}>{t('proposals.noRatings')}</Text>
            )}
          </View>
        </View>
        <StatusChip label={t(`proposals.status.${proposal.status}`)} tone={PROPOSAL_TONE[proposal.status]} />
      </Pressable>

      <Text style={styles.offer}>{t('proposals.priceDays', { price: formatINR(proposal.price_paise), count: proposal.delivery_days })}</Text>
      <Text style={styles.message}>{proposal.message}</Text>

      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  headerText: { flex: 1, gap: 2 },
  name: { ...type.subheading, color: colors.text },
  headline: { ...type.small, color: colors.muted },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { ...type.caption, color: colors.muted },
  offer: { ...type.heading, fontSize: 20, color: colors.primaryPressed },
  message: { ...type.body, color: colors.text },
  actions: { gap: 10 },
});
