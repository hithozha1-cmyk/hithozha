create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_ta text not null,
  icon text not null,
  sort_order integer not null default 0
);

alter table public.categories enable row level security;

revoke all on public.categories from anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

create policy "categories are readable by everyone"
  on public.categories for select
  to anon, authenticated
  using (true);

-- Writes are admin-only; the grant above is narrowed by these policies.
create policy "admins insert categories"
  on public.categories for insert
  to authenticated
  with check (public.is_admin());

create policy "admins update categories"
  on public.categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admins delete categories"
  on public.categories for delete
  to authenticated
  using (public.is_admin());

insert into public.categories (slug, name_en, name_ta, icon, sort_order) values
  ('video-editing',  'Video editing',   'வீடியோ எடிட்டிங்',      'video',     1),
  ('web-design',     'Web design',      'வலைத்தள வடிவமைப்பு',   'monitor',   2),
  ('graphic-design', 'Graphic design',  'கிராஃபிக் வடிவமைப்பு', 'pen-tool',  3),
  ('social-media',   'Social media',    'சமூக ஊடகம்',            'megaphone', 4),
  ('photography',    'Photography',     'புகைப்படக்கலை',         'camera',    5),
  ('tuition',        'Tuition',         'டியூஷன்',                'book-open', 6),
  ('writing',        'Writing',         'எழுத்துப் பணி',          'file-text', 7),
  ('voice-over',     'Voice-over',      'குரல் பதிவு',            'mic',       8);
