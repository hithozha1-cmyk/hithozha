import { formatINR } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import type { VerificationStatus } from '@/lib/types';

export const JOB_TYPES = ['one_time', 'monthly', 'part_time'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const WORK_MODES = ['online', 'in_person'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const HOURS_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40] as const;
export const MIN_BUDGET_RUPEES = 50;
export const MAX_BUDGET_RUPEES = 10_000_000;

/** Monthly and part-time jobs are paid per month, so their budget is a monthly one. */
export const isRecurring = (type: JobType): boolean => type === 'monthly' || type === 'part_time';

export type JobCompany = {
  id: string;
  name: string;
  logo_url: string | null;
  verification_status: VerificationStatus;
};

export type JobClient = {
  full_name: string | null;
  avatar_url: string | null;
};

export type Job = {
  id: string;
  client_id: string;
  company_id: string | null;
  title: string;
  description: string;
  category_slug: string;
  job_type: JobType;
  hours_per_week: number | null;
  budget_min_paise: number;
  budget_max_paise: number;
  work_mode: WorkMode;
  city: string | null;
  status: 'open' | 'closed';
  created_at: string;
  company: JobCompany | null;
  client: JobClient | null;
};

export const JOB_SELECT =
  'id, client_id, company_id, title, description, category_slug, job_type, hours_per_week, ' +
  'budget_min_paise, budget_max_paise, work_mode, city, status, created_at, ' +
  'company:companies!company_id(id, name, logo_url, verification_status), ' +
  'client:profiles!client_id(full_name, avatar_url)';

/** "₹5,000 to ₹10,000", or a single figure when min and max match. */
export const budgetRange = (job: Pick<Job, 'budget_min_paise' | 'budget_max_paise'>): string =>
  job.budget_min_paise === job.budget_max_paise
    ? formatINR(job.budget_min_paise)
    : `${formatINR(job.budget_min_paise)} – ${formatINR(job.budget_max_paise)}`;

/** The company name when a company posted it, otherwise the person's name. */
export const posterName = (job: Job): string => job.company?.name ?? job.client?.full_name ?? '';

const asJobs = (data: unknown): Job[] => (data ?? []) as Job[];

export async function fetchOpenJobs(): Promise<Job[] | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(50);
  return error ? null : asJobs(data);
}

export async function fetchCompanyJobs(companyId: string): Promise<Job[] | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select(JOB_SELECT)
    .eq('company_id', companyId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(50);
  return error ? null : asJobs(data);
}

export async function fetchJob(id: string): Promise<Job | null> {
  const { data, error } = await supabase.from('jobs').select(JOB_SELECT).eq('id', id).maybeSingle();
  return error || !data ? null : (data as unknown as Job);
}
