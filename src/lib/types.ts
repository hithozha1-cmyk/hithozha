export type Language = 'ta' | 'en';
export type Role = 'client' | 'freelancer' | 'both';
export type ClientType = 'individual' | 'company';
export type VerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  language: Language;
  role: Role | null;
  client_type: ClientType | null;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
};

// phone and is_admin are not readable from the client (see migration 0001).
export const PROFILE_COLUMNS =
  'id, full_name, avatar_url, city, language, role, client_type, verification_status, created_at, updated_at';

export type Category = {
  id: string;
  slug: string;
  name_en: string;
  name_ta: string;
  icon: string;
  sort_order: number;
  is_active?: boolean;
};

export const isFreelancerRole = (role: Role | null): boolean => role === 'freelancer' || role === 'both';
export const isClientRole = (role: Role | null): boolean => role === 'client' || role === 'both';
