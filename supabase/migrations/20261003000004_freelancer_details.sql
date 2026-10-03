-- Richer freelancer profiles: what buyers look at before hiring.
alter table public.freelancer_profiles
  add column headline text check (char_length(headline) <= 80),
  add column experience_level text check (experience_level in ('beginner', 'intermediate', 'expert')),
  add column languages text[] not null default '{}' check (cardinality(languages) <= 10),
  add column availability text check (availability in ('full_time', 'part_time', 'weekends')),
  -- Money is always stored as integer paise.
  add column starting_price_paise integer check (starting_price_paise >= 0),
  add column education text check (char_length(education) <= 200),
  add column portfolio_urls text[] not null default '{}' check (cardinality(portfolio_urls) <= 6);

-- Same rule as the original columns: users write these, but never ratings,
-- order counts or premium status.
grant insert (headline, experience_level, languages, availability, starting_price_paise, education, portfolio_urls),
      update (headline, experience_level, languages, availability, starting_price_paise, education, portfolio_urls)
  on public.freelancer_profiles to authenticated;
