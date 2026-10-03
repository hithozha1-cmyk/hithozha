export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'expert'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const AVAILABILITY_OPTIONS = ['full_time', 'part_time', 'weekends'] as const;
export type Availability = (typeof AVAILABILITY_OPTIONS)[number];

export const LANGUAGE_KEYS = ['ta', 'en', 'hi', 'te', 'ml', 'kn'] as const;

export const MAX_PORTFOLIO_IMAGES = 6;
export const MIN_BIO_LENGTH = 20;
export const MIN_STARTING_PRICE_RUPEES = 50;
