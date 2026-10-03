import { useFocusEffect, useRouter } from 'expo-router';
import { MessageCircle, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { ProposalCard } from '@/components/ProposalCard';
import { confirmAction } from '@/lib/confirm';
import type { Job } from '@/lib/jobs';
import { countJobProposals, fetchConversationId, fetchMyProposal, type Proposal } from '@/lib/proposals';
import { supabase } from '@/lib/supabase';
import { isFreelancerRole } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

/** The "apply" or "view proposals" part of the job detail screen. */
export function JobProposalPanel({ job }: { job: Job }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const isOwner = userId === job.client_id;
  const canApply = !isOwner && isFreelancerRole(profile?.role ?? null);

  const [pendingCount, setPendingCount] = useState(0);
  const [mine, setMine] = useState<Proposal | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reload when the screen comes back into view, e.g. after sending a proposal.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const load = async () => {
        if (isOwner) {
          const count = await countJobProposals(job.id);
          if (active) setPendingCount(count);
        } else if (canApply && userId) {
          const proposal = await fetchMyProposal(job.id, userId);
          if (active) setMine(proposal);
        }
        if (active) setReady(true);
      };
      void load();
      return () => {
        active = false;
      };
    }, [isOwner, canApply, userId, job.id]),
  );

  const openChat = async (proposalId: string) => {
    setError(null);
    const conversationId = await fetchConversationId(proposalId);
    if (conversationId) router.push({ pathname: '/chat/[id]', params: { id: conversationId } });
    else setError(t('common.genericError'));
  };

  const withdraw = (proposal: Proposal) =>
    confirmAction({
      title: t('proposals.withdrawTitle'),
      message: t('proposals.withdrawBody'),
      confirmLabel: t('proposals.withdraw'),
      cancelLabel: t('common.cancel'),
      onConfirm: () => {
        setBusy(true);
        setError(null);
        void supabase
          .from('proposals')
          .update({ status: 'withdrawn' })
          .eq('id', proposal.id)
          .then(({ error: updateError }) => {
            setBusy(false);
            if (updateError) setError(t('proposals.withdrawFailed'));
            else setMine({ ...proposal, status: 'withdrawn' });
          });
      },
    });

  if (!ready) return null;

  if (isOwner) {
    return (
      <View style={styles.section}>
        <Button
          variant="outline"
          title={t('proposals.viewProposals', { count: pendingCount })}
          icon={<Users size={20} color={colors.text} strokeWidth={1.8} />}
          onPress={() => router.push({ pathname: '/jobs/proposals/[id]', params: { id: job.id } })}
        />
      </View>
    );
  }

  if (!canApply) return null;

  if (!mine) {
    if (job.status !== 'open') return null;
    return (
      <View style={styles.section}>
        <Button title={t('proposals.apply')} onPress={() => router.push({ pathname: '/jobs/apply/[id]', params: { id: job.id } })} />
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{t('proposals.yourProposal')}</Text>
      <ProposalCard
        proposal={mine}
        actions={
          <>
            <Button
              variant="outline"
              title={t('proposals.message')}
              icon={<MessageCircle size={20} color={colors.text} strokeWidth={1.8} />}
              onPress={() => void openChat(mine.id)}
            />
            {mine.status === 'pending' ? (
              <Button variant="outline" title={t('proposals.withdraw')} onPress={() => withdraw(mine)} loading={busy} />
            ) : null}
          </>
        }
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: 24 },
  title: { ...type.subheading, color: colors.text },
  error: { ...type.small, color: colors.danger },
});
