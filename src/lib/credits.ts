import { supabase } from '@/lib/supabase';

export type ApplicationCredits = {
  used: number;
  allowed: number;
  remaining: number;
  /** When the monthly allowance starts again (the 1st, India time). */
  resetsAt: Date;
};

/** Error code the database raises when the monthly application limit is reached. */
export const LIMIT_REACHED_CODE = '54000';

/** How many free applications the signed-in freelancer has left this month. Null if it could not be loaded. */
export async function fetchApplicationCredits(): Promise<ApplicationCredits | null> {
  const { data, error } = await supabase.rpc('my_application_credits');
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return null;
  return { used: row.used, allowed: row.allowed, remaining: row.remaining, resetsAt: new Date(row.resets_at) };
}
