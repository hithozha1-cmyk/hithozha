import { supabase } from '@/lib/supabase';

export const REPORT_REASONS = ['spam', 'scam', 'abuse', 'fake', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export type ReportOutcome = 'sent' | 'duplicate' | 'limit' | 'failed';

/** Reports a person or a job to the Hithozha team. Only admins can read reports. */
export async function submitReport(targetType: 'user' | 'job', targetId: string, reason: ReportReason, details: string): Promise<ReportOutcome> {
  const { error } = await supabase.rpc('submit_report', { p_target_type: targetType, p_target_id: targetId, p_reason: reason, p_details: details.trim() || null });
  if (!error) return 'sent';
  if (error.code === '23505') return 'duplicate'; // already reported and still open
  if (error.code === '54000') return 'limit';
  return 'failed';
}
