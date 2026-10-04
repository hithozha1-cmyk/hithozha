import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { currentLanguage, hasExplicitLanguage, setAppLanguage } from '@/i18n';
import type { MyCompany } from '@/lib/company';
import { unregisterPush } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import { PROFILE_COLUMNS, type Language, type Profile } from '@/lib/types';

export type ProfilePatch = Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'city' | 'language' | 'role' | 'client_type'>>;

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  /** The signed-in user's own company, with private fields; null if they have none. */
  company: MyCompany | null;
  loading: boolean;
  profileError: boolean;
  isAdmin: boolean;
  /**
   * True when someone is signed in and not in the middle of resetting a password.
   * Use this, not `session`, to decide which part of the app to show.
   */
  signedIn: boolean;
  /**
   * Verifying a reset code signs the person in before they have chosen a new
   * password. While this is on, the app keeps showing the reset screen.
   */
  beginRecovery: () => void;
  completeRecovery: () => void;
  /** A signed-in user has finished onboarding once role, name and city are set. */
  onboarded: boolean;
  /**
   * A freelancer-only account waits on the verification screen until an admin approves their ID.
   * (People who also hire can use the app meanwhile, but cannot apply to jobs.)
   */
  needsVerification: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<boolean>;
  changeLanguage: (language: Language) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<MyCompany | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const beginRecovery = useCallback(() => setRecovering(true), []);
  const completeRecovery = useCallback(() => setRecovering(false), []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setSessionReady(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (id: string) => {
    setProfileError(false);
    const [profileResult, companyResult, adminResult] = await Promise.all([
      supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle(),
      supabase.rpc('get_my_company'),
      supabase.rpc('is_admin_account'),
    ]);
    setIsAdmin(!adminResult.error && adminResult.data === true);
    if (profileResult.error || !profileResult.data) {
      setProfile(null);
      setCompany(null);
      setProfileError(true);
    } else {
      setProfile(profileResult.data as Profile);
      // A failed company lookup must not block the app: treat it as no company.
      const rows = companyResult.error ? [] : ((companyResult.data ?? []) as MyCompany[]);
      setCompany(rows[0] ?? null);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setCompany(null);
      setProfileError(false);
      return;
    }
    void loadProfile(userId);
  }, [userId, loadProfile]);

  // Reconcile the language between this device and the profile once per profile load.
  const profileLanguage = profile?.language;
  const profileId = profile?.id;
  useEffect(() => {
    if (!profileId || !profileLanguage) return;
    if (hasExplicitLanguage()) {
      const local = currentLanguage();
      if (local !== profileLanguage) {
        void supabase
          .from('profiles')
          .update({ language: local })
          .eq('id', profileId)
          .then(({ error }) => {
            if (!error) setProfile((prev) => (prev ? { ...prev, language: local } : prev));
          });
      }
    } else if (currentLanguage() !== profileLanguage) {
      void setAppLanguage(profileLanguage);
    }
  }, [profileId, profileLanguage]);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!userId) return false;
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', userId)
        .select(PROFILE_COLUMNS)
        .single();
      if (error) return false;
      setProfile(data as Profile);
      return true;
    },
    [userId],
  );

  const changeLanguage = useCallback(
    async (language: Language) => {
      await setAppLanguage(language);
      if (userId) await updateProfile({ language });
    },
    [userId, updateProfile],
  );

  const signOut = useCallback(async () => {
    // Stop pushes to this phone while we can still tell the database who is signing out.
    await unregisterPush();
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      company,
      // Not "loading" while resetting a password: the reset screen must stay mounted.
      loading: !sessionReady || (!recovering && !!userId && !profile && !profileError),
      profileError,
      isAdmin,
      signedIn: !!session && !recovering,
      beginRecovery,
      completeRecovery,
      onboarded: !!profile?.role && !!profile.city && !!profile.full_name,
      needsVerification: profile?.role === 'freelancer' && profile.verification_status !== 'verified' && !isAdmin,
      refreshProfile,
      updateProfile,
      changeLanguage,
      signOut,
    }),
    [
      session,
      profile,
      company,
      sessionReady,
      userId,
      profileError,
      isAdmin,
      recovering,
      beginRecovery,
      completeRecovery,
      refreshProfile,
      updateProfile,
      changeLanguage,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
