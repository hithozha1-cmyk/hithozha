import { normalizeUrl } from '@/lib/company';
import { toPaise } from '@/lib/money';
import type { FreelancerDetails } from '@/lib/onboarding';
import {
  AVAILABILITY_OPTIONS,
  EXPERIENCE_LEVELS,
  MIN_BIO_LENGTH,
  MIN_STARTING_PRICE_RUPEES,
  type Availability,
  type ExperienceLevel,
} from '@/lib/professional';

export type FreelancerFormValues = {
  headline: string;
  skills: string[];
  experience: ExperienceLevel | null;
  languages: string[];
  availability: Availability | null;
  /** Rupees as typed by the user; empty means "no starting price". */
  price: string;
  bio: string;
  education: string;
  portfolio: string[];
  /** The freelancer's own website, as typed. Empty means none. */
  website: string;
};

export const EMPTY_FREELANCER: FreelancerFormValues = {
  headline: '',
  skills: [],
  experience: null,
  languages: ['ta'],
  availability: null,
  price: '',
  bio: '',
  education: '',
  portfolio: [],
  website: '',
};

/** The freelancer_profiles columns the form reads and writes. */
export const FREELANCER_COLUMNS =
  'headline, skills, experience_level, languages, availability, starting_price_paise, bio, education, portfolio_urls, portfolio_website';

export type FreelancerRow = {
  headline: string | null;
  skills: string[];
  experience_level: string | null;
  languages: string[];
  availability: string | null;
  starting_price_paise: number | null;
  bio: string | null;
  education: string | null;
  portfolio_urls: string[];
  portfolio_website?: string | null;
};

export function freelancerToFormValues(row: FreelancerRow): FreelancerFormValues {
  return {
    headline: row.headline ?? '',
    skills: row.skills ?? [],
    experience: EXPERIENCE_LEVELS.find((level) => level === row.experience_level) ?? null,
    languages: row.languages ?? [],
    availability: AVAILABILITY_OPTIONS.find((option) => option === row.availability) ?? null,
    price: row.starting_price_paise ? String(Math.round(row.starting_price_paise / 100)) : '',
    bio: row.bio ?? '',
    education: row.education ?? '',
    portfolio: row.portfolio_urls ?? [],
    website: row.portfolio_website ?? '',
  };
}

export type FreelancerField = 'headline' | 'skills' | 'experience' | 'languages' | 'availability' | 'price' | 'bio' | 'website';

const E = 'onboarding.professional';

/**
 * Checks the form. Returns i18n keys for each invalid field, and the database
 * payload when everything is valid.
 */
export function validateFreelancer(values: FreelancerFormValues): {
  errors: Partial<Record<FreelancerField, string>>;
  details: FreelancerDetails | null;
} {
  const errors: Partial<Record<FreelancerField, string>> = {};
  if (values.headline.trim().length < 3) errors.headline = `${E}.headlineRequired`;
  if (values.skills.length === 0) errors.skills = `${E}.skillsRequired`;
  if (!values.experience) errors.experience = `${E}.experienceRequired`;
  if (values.languages.length === 0) errors.languages = `${E}.languagesRequired`;
  if (!values.availability) errors.availability = `${E}.availabilityRequired`;
  if (values.bio.trim().length < MIN_BIO_LENGTH) errors.bio = `${E}.bioRequired`;

  const website = normalizeUrl(values.website);
  if (values.website.trim() !== '' && !website) errors.website = `${E}.websiteInvalid`;

  let startingPricePaise: number | null = null;
  if (values.price.trim() !== '') {
    const rupees = Number(values.price);
    if (!Number.isFinite(rupees) || rupees < MIN_STARTING_PRICE_RUPEES) errors.price = `${E}.priceInvalid`;
    else startingPricePaise = toPaise(rupees);
  }

  if (Object.keys(errors).length > 0 || !values.experience || !values.availability) return { errors, details: null };

  return {
    errors,
    details: {
      headline: values.headline.trim(),
      skills: values.skills,
      experience_level: values.experience,
      languages: values.languages,
      availability: values.availability,
      starting_price_paise: startingPricePaise,
      bio: values.bio.trim(),
      education: values.education.trim() || null,
      portfolio_urls: values.portfolio,
      portfolio_website: website,
    },
  };
}
