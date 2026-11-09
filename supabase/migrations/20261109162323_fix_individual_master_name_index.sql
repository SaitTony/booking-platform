-- Rebuild the normalized-name index with the intended whitespace expression.
drop index if exists public.masters_individual_name_uq;
create unique index masters_individual_name_uq
  on public.masters (lower(regexp_replace(btrim(display_name), '\s+', ' ', 'g')))
  where kind = 'individual'::public.master_kind and archived_at is null;
