-- A freelancer's own portfolio website (optional), shown on their public profile.
alter table public.freelancer_profiles
  add column portfolio_website text check (portfolio_website ~* '^https?://[^[:space:]]+$' and char_length(portfolio_website) <= 200);

-- Written by the freelancer like the other profile details; never by anyone else.
grant insert (portfolio_website), update (portfolio_website) on public.freelancer_profiles to authenticated;
