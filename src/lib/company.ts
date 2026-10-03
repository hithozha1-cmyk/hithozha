import type { VerificationStatus } from '@/lib/types';

export const TEAM_SIZES = ['1-10', '11-50', '51-200', '200+'] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export const INDUSTRIES = [
  'technology',
  'ecommerce',
  'manufacturing',
  'education',
  'healthcare',
  'retail',
  'food',
  'finance',
  'media',
  'logistics',
  'realEstate',
  'agriculture',
  'other',
] as const;

// Same patterns as the CHECK constraints in migration 0005.
export const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const UDYAM_PATTERN = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;

/** Columns readable by any signed-in user (gst_number / udyam_number are private). */
export const COMPANY_COLUMNS =
  'id, owner_id, name, logo_url, website, linkedin_url, team_size, industry, city, about, verification_status, created_at, updated_at';

export type Company = {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  linkedin_url: string | null;
  team_size: TeamSize;
  industry: string;
  city: string | null;
  about: string | null;
  verification_status: VerificationStatus;
  created_at: string;
  updated_at: string;
};

/** The owner's own row from get_my_company(), including the private numbers. */
export type MyCompany = Company & {
  gst_number: string | null;
  udyam_number: string | null;
};

export type CompanyFormValues = {
  logoUrl: string | null;
  name: string;
  website: string;
  linkedin: string;
  teamSize: TeamSize | null;
  industry: string | null;
  city: string | null;
  about: string;
};

export const EMPTY_COMPANY: CompanyFormValues = {
  logoUrl: null,
  name: '',
  website: '',
  linkedin: '',
  teamSize: null,
  industry: null,
  city: null,
  about: '',
};

export const companyToFormValues = (company: Company): CompanyFormValues => ({
  logoUrl: company.logo_url,
  name: company.name,
  website: company.website ?? '',
  linkedin: company.linkedin_url ?? '',
  teamSize: company.team_size,
  industry: company.industry,
  city: company.city,
  about: company.about ?? '',
});

/** Accepts "example.com" or a full link; returns an http(s) URL, or null if it is not one. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname.includes('.')) return null;
    if (/\s/.test(candidate) || candidate.length > 200) return null;
    return candidate;
  } catch {
    return null;
  }
}

export function normalizeLinkedIn(input: string): string | null {
  const url = normalizeUrl(input);
  if (!url) return null;
  const host = new URL(url).hostname.toLowerCase();
  return host === 'linkedin.com' || host.endsWith('.linkedin.com') ? url : null;
}

export type CompanyField = 'name' | 'teamSize' | 'industry' | 'city' | 'website' | 'linkedin';

/** Returns i18n keys for each invalid field. */
export function validateCompany(values: CompanyFormValues): Partial<Record<CompanyField, string>> {
  const errors: Partial<Record<CompanyField, string>> = {};
  const nameLength = values.name.trim().length;
  if (nameLength < 2 || nameLength > 80) errors.name = 'company.errors.nameRequired';
  if (!values.teamSize) errors.teamSize = 'company.errors.teamSizeRequired';
  if (!values.industry) errors.industry = 'company.errors.industryRequired';
  if (!values.city) errors.city = 'company.errors.cityRequired';
  if (values.website.trim() !== '' && !normalizeUrl(values.website)) errors.website = 'company.errors.websiteInvalid';
  if (values.linkedin.trim() !== '' && !normalizeLinkedIn(values.linkedin)) errors.linkedin = 'company.errors.linkedinInvalid';
  return errors;
}

/** Database columns for a validated form. */
export const companyRow = (values: CompanyFormValues) => ({
  name: values.name.trim(),
  logo_url: values.logoUrl,
  website: normalizeUrl(values.website),
  linkedin_url: normalizeLinkedIn(values.linkedin),
  team_size: values.teamSize,
  industry: values.industry,
  city: values.city,
  about: values.about.trim() || null,
});
