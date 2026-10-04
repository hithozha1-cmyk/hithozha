import { supabase } from '@/lib/supabase';

/** Error code the database raises when there are not enough tokens, or a plan limit is reached. */
export const LIMIT_REACHED_CODE = '54000';

export type Audience = 'freelancer' | 'client';

export type Tokens = {
  /** Free tokens left this month. They expire at the end of the month. */
  free: number;
  /** Lasting tokens (gifts, referrals, later purchases). They never expire. */
  bought: number;
  total: number;
  /** What the person's plan gives each month. */
  monthly: number;
  /** When the next monthly tokens arrive (the 1st, India time). */
  resetsAt: Date;
};

export type MyPlan = {
  code: string;
  name: string;
  monthlyTokens: number;
  commissionBps: number;
  /** Null means unlimited. */
  maxPackages: number | null;
  maxOpenJobs: number | null;
  expiresAt: Date | null;
};

export type PlanInfo = {
  code: string;
  audience: Audience;
  name: string;
  monthly_tokens: number;
  commission_bps: number;
  max_packages: number | null;
  max_open_jobs: number | null;
  price_month_paise: number;
  price_year_paise: number;
  sort_order: number;
};

/** What a new order keeps from the freelancer when nothing else is known: 5%. */
export const DEFAULT_COMMISSION_BPS = 500;

/** 500 becomes "5", 250 becomes "2.5". */
export const commissionPercent = (bps: number): string => (bps % 100 === 0 ? String(bps / 100) : (bps / 100).toFixed(1));

export async function fetchTokens(): Promise<Tokens | null> {
  const { data, error } = await supabase.rpc('my_tokens');
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return null;
  return { free: row.free, bought: row.bought, total: row.total, monthly: row.monthly, resetsAt: new Date(row.resets_at) };
}

export async function fetchMyPlan(audience: Audience): Promise<MyPlan | null> {
  const { data, error } = await supabase.rpc('my_plan', { p_audience: audience });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return null;
  return {
    code: row.plan_code,
    name: row.plan_name,
    monthlyTokens: row.monthly_tokens,
    commissionBps: row.commission_bps,
    maxPackages: row.max_packages,
    maxOpenJobs: row.max_open_jobs,
    expiresAt: row.expires_at ? new Date(row.expires_at) : null,
  };
}

/** The public price list. */
export async function fetchPlans(): Promise<PlanInfo[] | null> {
  const { data, error } = await supabase
    .from('plans')
    .select('code, audience, name, monthly_tokens, commission_bps, max_packages, max_open_jobs, price_month_paise, price_year_paise, sort_order')
    .order('sort_order', { ascending: true });
  return error ? null : ((data ?? []) as PlanInfo[]);
}
