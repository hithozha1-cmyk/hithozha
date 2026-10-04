import { supabase } from '@/lib/supabase';
import { DEFAULT_COMMISSION_BPS } from '@/lib/tokens';

export const PROPOSAL_STATUSES = ['pending', 'accepted', 'rejected', 'withdrawn'] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const MIN_PROPOSAL_RUPEES = 50;
export const MIN_PROPOSAL_MESSAGE = 20;

export type ProposalFreelancer = {
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  verification_status: string;
  freelancer_profiles: {
    headline: string | null;
    rating_avg: number;
    rating_count: number;
    completed_orders: number;
  } | null;
};

export type Proposal = {
  id: string;
  job_id: string;
  freelancer_id: string;
  message: string;
  price_paise: number;
  delivery_days: number;
  status: ProposalStatus;
  created_at: string;
  freelancer: ProposalFreelancer | null;
};

export const PROPOSAL_SELECT =
  'id, job_id, freelancer_id, message, price_paise, delivery_days, status, created_at, ' +
  'freelancer:profiles!freelancer_id(full_name, avatar_url, city, verification_status, freelancer_profiles(headline, rating_avg, rating_count, completed_orders))';

/** What the freelancer keeps after the platform fee, in paise (rounded half up, same as the database). */
export const earningsAfterFee = (pricePaise: number, commissionBps: number = DEFAULT_COMMISSION_BPS): number =>
  pricePaise - Math.floor((pricePaise * commissionBps + 5000) / 10000);

export async function fetchJobProposals(jobId: string): Promise<Proposal[] | null> {
  const { data, error } = await supabase
    .from('proposals')
    .select(PROPOSAL_SELECT)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });
  return error ? null : ((data ?? []) as unknown as Proposal[]);
}

/** The signed-in freelancer's own proposal for a job, if they sent one. */
export async function fetchMyProposal(jobId: string, userId: string): Promise<Proposal | null> {
  const { data } = await supabase
    .from('proposals')
    .select(PROPOSAL_SELECT)
    .eq('job_id', jobId)
    .eq('freelancer_id', userId)
    .maybeSingle();
  return (data as unknown as Proposal | null) ?? null;
}

export async function countJobProposals(jobId: string): Promise<number> {
  const { count } = await supabase
    .from('proposals')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .eq('status', 'pending');
  return count ?? 0;
}

/** The conversation that belongs to a proposal. */
export async function fetchConversationId(proposalId: string): Promise<string | null> {
  const { data } = await supabase.from('conversations').select('id').eq('proposal_id', proposalId).maybeSingle();
  return data?.id ?? null;
}

/** The client opened their proposals list: the freelancers' tokens are not given back for these. */
export const markProposalsViewed = async (jobId: string): Promise<void> => {
  await supabase.rpc('mark_job_proposals_viewed', { p_job: jobId });
};
