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
  /** A signed-in user has finished onboarding once role, name and city are set. */
  onboarded: boolean;
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

  const userId = session?.user.id ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setSessionReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async (id: string) => {
    setProfileError(false);
    const [profileResult, companyResult] = await Promise.all([
      supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', id).maybeSingle(),
      supabase.rpc('get_my_company'),
    ]);
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
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      company,
      loading: !sessionReady || (!!userId && !profile && !profileError),
      profileError,
      onboarded: !!profile?.role && !!profile.city && !!profile.full_name,
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
