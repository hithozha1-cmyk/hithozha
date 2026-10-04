import { companyRow, type CompanyFormValues } from '@/lib/company';
import { supabase } from '@/lib/supabase';
import { isClientRole, isFreelancerRole, type ClientType, type Role } from '@/lib/types';

export type OnboardingScreen = 'role' | 'client-type' | 'company-profile' | 'profile' | 'professional';

/**
 * The screens a user passes through after signing up. Step 1 is the account
 * itself, so the role screen is always step 2. Until a client picks a type
 * they are assumed to be an individual.
 */
export function onboardingSteps(role: Role | null, clientType: ClientType | null): OnboardingScreen[] {
  const steps: OnboardingScreen[] = ['role'];
  if (isClientRole(role)) {
    steps.push('client-type');
    if (clientType === 'company') steps.push('company-profile');
  }
  steps.push('profile');
  if (isFreelancerRole(role)) steps.push('professional');
  return steps;
}

export type FreelancerDetails = {
  headline: string;
  skills: string[];
  experience_level: string;
  languages: string[];
  availability: string;
  starting_price_paise: number | null;
  bio: string;
  education: string | null;
  portfolio_urls: string[];
  portfolio_website: string | null;
};

type CompleteParams = {
  userId: string;
  name: string;
  city: string;
  avatarUrl: string | null;
  role: Role;
  clientType: ClientType | null;
  company: CompanyFormValues | null;
  freelancer: FreelancerDetails | null;
};

/**
 * Saves everything collected during onboarding. The profile row is written
 * last: the auth gate treats role + name + city as "onboarding complete", so
 * nothing is half-saved if an earlier write fails. Returns false on failure.
 */
export async function completeOnboarding(params: CompleteParams): Promise<boolean> {
  const { userId, name, city, avatarUrl, role, clientType, company, freelancer } = params;

  if (isClientRole(role) && clientType === 'company' && company) {
    const { error } = await supabase
      .from('companies')
      .upsert({ owner_id: userId, ...companyRow(company) }, { onConflict: 'owner_id' });
    if (error) return false;
  }

  if (isFreelancerRole(role) && freelancer) {
    const { error } = await supabase
      .from('freelancer_profiles')
      .upsert({ user_id: userId, ...freelancer }, { onConflict: 'user_id' });
    if (error) return false;
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: name.trim(),
      city,
      avatar_url: avatarUrl,
      client_type: isClientRole(role) ? clientType : null,
    })
    .eq('id', userId);
  return !error;
}
