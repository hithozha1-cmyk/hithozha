-- Only freelancers whose identity has been verified can send proposals.
-- (New freelancers wait on a holding screen until an admin approves their ID photo and selfie.)
drop policy "freelancers send proposals to open jobs they do not own" on public.proposals;

create policy "verified freelancers send proposals to open jobs they do not own"
  on public.proposals for insert
  to authenticated
  with check (
    freelancer_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('freelancer', 'both') and p.verification_status = 'verified'
    )
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.status = 'open' and j.client_id <> auth.uid()
    )
  );
