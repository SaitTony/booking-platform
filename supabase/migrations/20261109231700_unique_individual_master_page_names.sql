-- Prevent duplicate names for active individual Master_pro pages.
-- Names are compared case-insensitively after trimming and collapsing whitespace.
create unique index if not exists masters_individual_name_uq
  on public.masters (lower(regexp_replace(btrim(display_name), '\\s+', ' ', 'g')))
  where kind = 'individual'::public.master_kind and archived_at is null;
