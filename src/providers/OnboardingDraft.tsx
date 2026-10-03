import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { EMPTY_COMPANY, companyToFormValues, type CompanyFormValues } from '@/lib/company';
import { onboardingSteps, type OnboardingScreen } from '@/lib/onboarding';
import type { ClientType, Role } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';

type Draft = {
  name: string;
  setName: (value: string) => void;
  city: string | null;
  setCity: (value: string | null) => void;
  avatarUrl: string | null;
  setAvatarUrl: (value: string | null) => void;
  clientType: ClientType | null;
  setClientType: (value: ClientType) => void;
  company: CompanyFormValues;
  setCompany: (value: CompanyFormValues) => void;
};

const DraftContext = createContext<Draft | null>(null);

/**
 * Holds what the user has entered while moving through onboarding. Nothing
 * beyond the role is written until the last step, because the auth gate
 * treats role + name + city as "onboarding complete".
 */
export function OnboardingDraftProvider({ children }: { children: ReactNode }) {
  const { profile, company: existingCompany } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [city, setCity] = useState<string | null>(profile?.city ?? null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const [clientType, setClientType] = useState<ClientType | null>(profile?.client_type ?? null);
  const [company, setCompany] = useState<CompanyFormValues>(
    existingCompany ? companyToFormValues(existingCompany) : EMPTY_COMPANY,
  );

  const value = useMemo(
    () => ({ name, setName, city, setCity, avatarUrl, setAvatarUrl, clientType, setClientType, company, setCompany }),
    [name, city, avatarUrl, clientType, company],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useOnboardingDraft(): Draft {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useOnboardingDraft must be used inside OnboardingDraftProvider');
  return ctx;
}

/** Step number and total for the progress bar on the given screen. */
export function useOnboardingProgress(screen: OnboardingScreen, roleOverride?: Role | null) {
  const { profile } = useAuth();
  const { clientType } = useOnboardingDraft();
  const steps = onboardingSteps(roleOverride ?? profile?.role ?? null, clientType);
  return { current: steps.indexOf(screen) + 2, total: steps.length + 1 };
}
