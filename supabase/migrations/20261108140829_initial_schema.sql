create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.platform_role as enum ('pending', 'owner', 'master_pro');
create type public.company_role as enum ('admin', 'master');
create type public.master_kind as enum ('individual', 'company');
create type public.booking_status as enum ('confirmed', 'cancelled', 'completed', 'no_show');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  platform_role public.platform_role not null default 'pending',
  force_password_change boolean not null default true,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  cover_url text,
  theme jsonb not null default '{"id":"natural"}'::jsonb,
  timezone text not null default 'Europe/Helsinki',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.masters (
  id uuid primary key default gen_random_uuid(),
  kind public.master_kind not null,
  company_id uuid references public.companies(id) on delete restrict,
  profile_id uuid unique references public.profiles(id) on delete set null,
  display_name text not null check (length(trim(display_name)) > 0),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  public_description text not null default '',
  photo_url text,
  timezone text not null default 'Europe/Helsinki',
  theme jsonb not null default '{"id":"natural"}'::jsonb,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'individual' and company_id is null) or (kind = 'company' and company_id is not null))
);
create unique index masters_individual_slug_uq on public.masters(slug) where kind = 'individual';
create unique index masters_company_slug_uq on public.masters(company_id, slug) where kind = 'company';
create index masters_company_idx on public.masters(company_id);

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  role public.company_role not null,
  master_id uuid unique references public.masters(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((role = 'admin' and master_id is null) or (role = 'master' and master_id is not null))
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  full_name text not null check (length(trim(full_name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  duration integer not null check (duration between 1 and 720),
  price numeric(12,2) not null check (price >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_master_active_idx on public.services(master_id, is_active);

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  is_day_off boolean not null default false,
  check (closes_at > opens_at),
  unique(master_id, weekday, opens_at)
);

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete cascade,
  exception_date date not null,
  is_day_off boolean not null default true,
  opens_at time,
  closes_at time,
  note text not null default '',
  check ((is_day_off and opens_at is null and closes_at is null) or
         (not is_day_off and opens_at is not null and closes_at is not null and closes_at > opens_at)),
  unique(master_id, exception_date)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  master_id uuid not null references public.masters(id) on delete restrict,
  service_id uuid references public.services(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'confirmed',
  service_name_snapshot text not null,
  service_duration_snapshot integer not null check (service_duration_snapshot > 0),
  price_snapshot numeric(12,2) not null check (price_snapshot >= 0),
  client_name_snapshot text not null,
  client_phone_snapshot text not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id) on delete set null,
  check (ends_at > starts_at),
  constraint bookings_no_overlap exclude using gist
    (master_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
    where (status = 'confirmed')
);
create index bookings_master_start_idx on public.bookings(master_id, starts_at);
create index bookings_client_idx on public.bookings(client_id);

create table public.booking_settings (
  master_id uuid primary key references public.masters(id) on delete cascade,
  booking_horizon_days integer not null default 30 check (booking_horizon_days between 1 and 90),
  minimum_lead_minutes integer not null default 10 check (minimum_lead_minutes between 0 and 1440),
  slot_step_minutes integer not null default 15 check (slot_step_minutes in (5,10,15,20,30,60)),
  rules_text text not null default 'Пожалуйста, приходите вовремя. Если планы изменились, заранее свяжитесь с мастером.'
);

create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  old_status public.booking_status,
  new_status public.booking_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_phone text;
begin
  v_name := nullif(trim(new.raw_user_meta_data->>'full_name'), '');
  v_phone := coalesce(new.phone, new.raw_user_meta_data->>'phone_e164');
  if v_name is null or v_phone is null then
    raise exception 'Для учётной записи обязательны имя и номер телефона';
  end if;
  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Номер телефона должен быть в формате E.164';
  end if;
  insert into public.profiles(id, full_name, phone_e164)
  values (new.id, v_name, v_phone);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create function public.is_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid()
    and p.platform_role = 'owner' and p.disabled_at is null and not p.force_password_change);
$$;

create function public.can_manage_master(p_master_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_owner()
  or exists(select 1 from public.masters m join public.profiles p on p.id = auth.uid()
    where m.id = p_master_id and m.profile_id = p.id and p.platform_role = 'master_pro'
      and p.disabled_at is null and not p.force_password_change)
  or exists(select 1 from public.masters m join public.company_members cm on cm.company_id = m.company_id
    join public.profiles p on p.id = cm.profile_id
    where m.id = p_master_id and cm.profile_id = auth.uid() and cm.role = 'admin'
      and p.disabled_at is null and not p.force_password_change);
$$;

create function public.can_view_master(p_master_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.can_manage_master(p_master_id)
  or exists(select 1 from public.company_members cm join public.profiles p on p.id = cm.profile_id
    where cm.master_id = p_master_id and cm.profile_id = auth.uid() and cm.role = 'master'
      and p.disabled_at is null and not p.force_password_change);
$$;

create function public.is_company_admin(p_company_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_owner() or exists(select 1 from public.company_members cm
    join public.profiles p on p.id = cm.profile_id
    where cm.company_id = p_company_id and cm.profile_id = auth.uid() and cm.role = 'admin'
      and p.disabled_at is null and not p.force_password_change);
$$;

create function public.complete_password_change()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Необходима авторизация'; end if;
  update public.profiles set force_password_change = false, updated_at = now() where id = auth.uid();
end;
$$;
revoke all on function public.complete_password_change() from public;
grant execute on function public.complete_password_change() to authenticated;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.masters enable row level security;
alter table public.company_members enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_settings enable row level security;
alter table public.booking_status_history enable row level security;

create policy profiles_read_self_owner on public.profiles for select to authenticated
using (id = auth.uid() or public.is_owner());
create policy companies_public_read on public.companies for select to anon, authenticated using (is_active);
create policy companies_admin_read on public.companies for select to authenticated
using (public.is_company_admin(id));
create policy companies_admin_update on public.companies for update to authenticated
using (public.is_company_admin(id)) with check (public.is_company_admin(id));
create policy masters_public_read on public.masters for select to anon, authenticated
using (is_active and archived_at is null and (company_id is null or exists
  (select 1 from public.companies c where c.id = company_id and c.is_active)));
create policy masters_manager_write on public.masters for all to authenticated
using (public.can_manage_master(id) or (company_id is not null and public.is_company_admin(company_id)))
with check (public.can_manage_master(id) or (company_id is not null and public.is_company_admin(company_id)));
create policy company_members_scoped_read on public.company_members for select to authenticated
using (public.is_owner() or profile_id = auth.uid() or public.is_company_admin(company_id));
create policy clients_scoped_read on public.clients for select to authenticated
using (public.is_owner() or exists(select 1 from public.bookings b
  where b.client_id = id and public.can_view_master(b.master_id)));
create policy services_public_read on public.services for select to anon, authenticated
using (is_active and exists(select 1 from public.masters m where m.id = master_id and m.is_active and m.archived_at is null));
create policy services_manager_write on public.services for all to authenticated
using (public.can_manage_master(master_id) or exists(select 1 from public.masters m
  where m.id = master_id and m.company_id is not null and public.is_company_admin(m.company_id)))
with check (public.can_manage_master(master_id) or exists(select 1 from public.masters m
  where m.id = master_id and m.company_id is not null and public.is_company_admin(m.company_id)));
create policy working_hours_public_read on public.working_hours for select to anon, authenticated
using (exists(select 1 from public.masters m where m.id = master_id and m.is_active and m.archived_at is null));
create policy working_hours_manager_write on public.working_hours for all to authenticated
using (public.can_manage_master(master_id) or exists(select 1 from public.masters m
  where m.id = master_id and m.company_id is not null and public.is_company_admin(m.company_id)))
with check (public.can_manage_master(master_id) or exists(select 1 from public.masters m
  where m.id = master_id and m.company_id is not null and public.is_company_admin(m.company_id)));
create policy exceptions_public_read on public.schedule_exceptions for select to anon, authenticated
using (exists(select 1 from public.masters m where m.id = master_id and m.is_active and m.archived_at is null));
create policy exceptions_manager_write on public.schedule_exceptions for all to authenticated
using (public.can_manage_master(master_id) or exists(select 1 from public.masters m
  where m.id = master_id and m.company_id is not null and public.is_company_admin(m.company_id)))
with check (public.can_manage_master(master_id) or exists(select 1 from public.masters m
  where m.id = master_id and m.company_id is not null and public.is_company_admin(m.company_id)));
create policy bookings_scoped_read on public.bookings for select to authenticated
using (public.is_owner() or public.can_view_master(master_id));
create policy bookings_manager_update on public.bookings for update to authenticated
using (public.is_owner() or public.can_manage_master(master_id))
with check (public.is_owner() or public.can_manage_master(master_id));
create policy settings_scoped_read on public.booking_settings for select to authenticated
using (public.can_view_master(master_id));
create policy settings_manager_write on public.booking_settings for all to authenticated
using (public.can_manage_master(master_id) or exists(select 1 from public.masters m
  where m.id = master_id and m.company_id is not null and public.is_company_admin(m.company_id)))
with check (public.can_manage_master(master_id) or exists(select 1 from public.masters m
  where m.id = master_id and m.company_id is not null and public.is_company_admin(m.company_id)));
create policy booking_history_scoped_read on public.booking_status_history for select to authenticated
using (exists(select 1 from public.bookings b where b.id = booking_id
  and (public.is_owner() or public.can_view_master(b.master_id))));

grant usage on schema public to anon, authenticated;
grant select on public.companies, public.masters, public.services, public.working_hours, public.schedule_exceptions to anon, authenticated;
grant select on public.profiles, public.company_members, public.clients, public.bookings,
  public.booking_settings, public.booking_status_history to authenticated;
