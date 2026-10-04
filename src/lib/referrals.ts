import { supabase } from '@/lib/supabase';

export type MyReferral = {
  code: string;
  friends: number;
  bonus: number;
  /** True for a new account that has not yet entered a friend's code. */
  can_redeem: boolean;
};

export const REFERRAL_REWARD = 5;
export const MAX_REWARDED_FRIENDS = 10;

export async function fetchMyReferral(): Promise<MyReferral | null> {
  const { data, error } = await supabase.rpc('my_referral');
  const row = Array.isArray(data) ? data[0] : data;
  return error || !row ? null : (row as MyReferral);
}

/** What the person sends to a friend: the code and where to use it. */
export const referralMessage = (template: string, code: string): string => template.replace('{{code}}', code);

/** Codes are 6 letters and digits; people may type them in lower case or with spaces. */
export const cleanReferralCode = (input: string): string => input.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);

export type RedeemOutcome = 'ok' | 'not_found' | 'own' | 'used' | 'late' | 'full' | 'failed';

export async function redeemReferral(code: string): Promise<RedeemOutcome> {
  const { error } = await supabase.rpc('redeem_referral', { p_code: cleanReferralCode(code) });
  if (!error) return 'ok';
  switch (error.code) {
    case 'P0002':
      return 'not_found';
    case '42501':
      return 'own';
    case '54000':
      return 'full';
    case '55000':
      // The database words these two differently; both mean "you cannot use a code now".
      return /already/i.test(error.message) ? 'used' : 'late';
    default:
      return 'failed';
  }
}
