import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Where the person stands on the admin site:
 *   loading     checking the saved session
 *   signedOut   needs to sign in with email and password
 *   notAdmin    signed in, but the account is not an admin
 *   enrol       an admin with no authenticator app yet: set one up
 *   verify      an admin with an authenticator app: enter the 6-digit code
 *   ready       signed in, admin, and the second step is done (the database now accepts admin actions)
 */
export type AdminAccess = 'loading' | 'signedOut' | 'notAdmin' | 'enrol' | 'verify' | 'ready';

export function useAdminAccess() {
  const [access, setAccess] = useState<AdminAccess>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);

  const evaluate = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setAccess('signedOut');
      return;
    }
    const { data: isAccount, error } = await supabase.rpc('is_admin_account');
    if (error || isAccount !== true) {
      setAccess('notAdmin');
      return;
    }
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level?.currentLevel === 'aal2') {
      setAccess('ready');
      return;
    }
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.[0]; // listFactors returns verified factors only
    setFactorId(verified?.id ?? null);
    setAccess(verified ? 'verify' : 'enrol');
  }, []);

  useEffect(() => {
    void evaluate();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      // Token refreshes also fire here; only changes in who is signed in or their MFA level matter.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'MFA_CHALLENGE_VERIFIED' || event === 'USER_UPDATED') void evaluate();
    });
    return () => data.subscription.unsubscribe();
  }, [evaluate]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setAccess('signedOut');
  }, []);

  return { access, factorId, reevaluate: evaluate, signOut };
}

export type Enrolment = { factorId: string; qrCode: string; secret: string };

/** Starts setting up an authenticator app. Clears any half-finished attempt first. */
export async function startEnrolment(): Promise<Enrolment | null> {
  const { data: all } = await supabase.auth.mfa.listFactors();
  for (const factor of all?.all ?? []) {
    if (factor.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `admin-${Date.now()}` });
  if (error || !data) return null;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Checks the 6-digit code. On success the session is upgraded, which is what the database requires. */
export async function verifyCode(factorId: string, code: string): Promise<boolean> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
  return !error;
}
