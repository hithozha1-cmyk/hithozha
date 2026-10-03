import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, FileText, MessageCircle } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { ProposalCard } from '@/components/ProposalCard';
import { Screen } from '@/components/Screen';
import { confirmAction } from '@/lib/confirm';
import { fetchJob, type Job } from '@/lib/jobs';
import { formatINR } from '@/lib/money';
import { acceptProposal, rejectProposal } from '@/lib/orders';
import { fetchConversationId, fetchJobProposals, type Proposal } from '@/lib/proposals';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, type } from '@/theme';

/** The job owner's list of proposals, with Accept, Decline and Message. */
export default function JobProposalsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [jobResult, list] = await Promise.all([fetchJob(id), fetchJobProposals(id)]);
    setJob(jobResult);
    setProposals(list);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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

  // Only the person who posted the job sees this list.
  if (!job || job.client_id !== session?.user.id) return <Redirect href="/" />;

  const openChat = async (proposalId: string) => {
    setError(null);
    const conversationId = await fetchConversationId(proposalId);
    if (conversationId) router.push({ pathname: '/chat/[id]', params: { id: conversationId } });
    else setError(t('common.genericError'));
  };

  const openOrder = async (proposalId: string) => {
    setError(null);
    const { data } = await supabase
      .from('orders')
      .select('id')
      .eq('proposal_id', proposalId)
      .neq('status', 'cancelled')
      .maybeSingle();
    if (data) router.push({ pathname: '/orders/[id]', params: { id: data.id } });
    else setError(t('common.genericError'));
  };

  const accept = (proposal: Proposal) =>
    confirmAction({
      title: t('proposals.acceptTitle', { name: proposal.freelancer?.full_name ?? '' }),
      message: t('proposals.acceptBody', { amount: formatINR(proposal.price_paise) }),
      confirmLabel: t('proposals.accept'),
      cancelLabel: t('common.cancel'),
      destructive: false,
      onConfirm: () => {
        setBusyId(proposal.id);
        setError(null);
        void acceptProposal(proposal.id).then((result) => {
          setBusyId(null);
          if (result) router.replace({ pathname: '/orders/[id]', params: { id: result.orderId } });
          else setError(t('proposals.acceptFailed'));
        });
      },
    });

  const decline = (proposal: Proposal) => {
    setBusyId(proposal.id);
    setError(null);
    void rejectProposal(proposal.id).then((result) => {
      setBusyId(null);
      if (result.ok) void load();
      else setError(t('proposals.rejectFailed'));
    });
  };

  const jobOpen = job.status === 'open';

  return (
    <Screen>
      {back}
      <Text style={styles.title}>{t('proposals.listTitle')}</Text>
      <Text style={styles.jobTitle} numberOfLines={2}>
        {job.title}
      </Text>

      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {proposals && proposals.length > 0 ? (
        <View style={styles.list}>
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              actions={
                <>
                  {proposal.status === 'pending' && jobOpen ? (
                    <>
                      <Button title={t('proposals.accept')} onPress={() => accept(proposal)} loading={busyId === proposal.id} />
                      <Button variant="outline" title={t('proposals.reject')} onPress={() => decline(proposal)} disabled={busyId === proposal.id} />
                    </>
                  ) : null}
                  {proposal.status === 'accepted' ? (
                    <Button
                      title={t('proposals.viewOrder')}
                      icon={<FileText size={20} color={colors.onDark} strokeWidth={1.8} />}
                      onPress={() => void openOrder(proposal.id)}
                    />
                  ) : null}
                  <Button
                    variant="outline"
                    title={t('proposals.message')}
                    icon={<MessageCircle size={20} color={colors.text} strokeWidth={1.8} />}
                    onPress={() => void openChat(proposal.id)}
                  />
                </>
              }
            />
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <EmptyState icon={FileText} title={t('proposals.emptyTitle')} message={t('proposals.emptyBody')} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: colors.text, paddingTop: 12 },
  jobTitle: { ...type.body, color: colors.muted, paddingBottom: 16 },
  list: { gap: 14 },
  empty: { minHeight: 320 },
  error: { ...type.small, color: colors.danger, marginBottom: 12 },
});
