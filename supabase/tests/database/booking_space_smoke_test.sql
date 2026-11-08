-- Functional smoke tests for Booking Space business rules and row-level access.
create extension if not exists pgtap with schema extensions;

begin;
select extensions.plan(27);

-- Test identities are created through the same Auth trigger used in production.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', null, '', now(),
   '+358401234567', now(), '{"provider":"phone","providers":["phone"]}', '{"full_name":"Test Owner"}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', null, '', now(),
   '+358401234568', now(), '{"provider":"phone","providers":["phone"]}', '{"full_name":"Test Admin"}', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', null, '', now(),
   '+358401234569', now(), '{"provider":"phone","providers":["phone"]}', '{"full_name":"Test Master"}', now(), now()),
  ('10000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', null, '', now(),
   '+358401234570', now(), '{"provider":"phone","providers":["phone"]}', '{"full_name":"Test Pro"}', now(), now());

update public.profiles
set platform_role = 'owner', force_password_change = false
where id = '10000000-0000-4000-8000-000000000001';

update public.profiles
set platform_role = 'master_pro', force_password_change = false
where id = '10000000-0000-4000-8000-000000000004';

-- These staff accounts have completed the required first-login password change.
update public.profiles
set force_password_change = false
where id in (
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003'
);

insert into public.companies (id, name, slug, timezone)
values ('20000000-0000-4000-8000-000000000001', 'Test Company', 'test-company', 'UTC');

insert into public.masters (id, kind, company_id, profile_id, display_name, slug, timezone)
values
  ('30000000-0000-4000-8000-000000000001', 'company', '20000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000003', 'Master A', 'master-a', 'UTC'),
  ('30000000-0000-4000-8000-000000000002', 'company', '20000000-0000-4000-8000-000000000001',
   null, 'Master B', 'master-b', 'UTC'),
  ('30000000-0000-4000-8000-000000000003', 'company', '20000000-0000-4000-8000-000000000001',
   null, 'Master C', 'master-c', 'UTC'),
  ('30000000-0000-4000-8000-000000000004', 'company', '20000000-0000-4000-8000-000000000001',
   null, 'Master D', 'master-d', 'UTC'),
  ('30000000-0000-4000-8000-000000000005', 'company', '20000000-0000-4000-8000-000000000001',
   null, 'Master E', 'master-e', 'UTC');

insert into public.company_members (company_id, profile_id, role, master_id)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'admin', null),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'master',
   '30000000-0000-4000-8000-000000000001');

insert into public.masters (id, kind, display_name, slug, profile_id, timezone)
values ('30000000-0000-4000-8000-000000000006', 'individual', 'Independent Pro', 'independent-pro',
        '10000000-0000-4000-8000-000000000004', 'UTC');

insert into public.services (id, master_id, name, duration, price)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'Consultation', 30, 50),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 'Consultation', 30, 50);

insert into public.working_hours (master_id, weekday, opens_at, closes_at)
select m.id, extract(dow from ((now() at time zone 'UTC')::date + 2))::smallint, time '09:10', time '11:00'
from public.masters m
where m.id in ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002');

insert into public.booking_settings (master_id)
values ('30000000-0000-4000-8000-000000000001'),
       ('30000000-0000-4000-8000-000000000002');

-- Schema and role helper checks.
select extensions.has_table('public', 'profiles', 'profiles table exists');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select extensions.ok(public.is_owner(), 'Owner identity is recognized');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select extensions.ok(public.can_manage_master('30000000-0000-4000-8000-000000000001'), 'Company Admin can manage company masters');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select extensions.ok(not public.can_manage_master('30000000-0000-4000-8000-000000000001'), 'Employee Master cannot manage pages');
select extensions.ok(public.can_view_master('30000000-0000-4000-8000-000000000001'), 'Employee Master can view own workspace');
select extensions.ok(not public.can_view_master('30000000-0000-4000-8000-000000000002'), 'Employee Master cannot view another master workspace');
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select extensions.ok(public.can_manage_master('30000000-0000-4000-8000-000000000006'), 'Master_pro can manage own individual page');
reset role;

-- The company page limit counts active, non-archived pages only.
select extensions.is(
  (select count(*)::integer from public.masters
   where company_id = '20000000-0000-4000-8000-000000000001' and is_active and archived_at is null),
  5, 'Company starts with five active master pages'
);
select extensions.throws_ok(
  $$insert into public.masters (kind, company_id, display_name, slug)
    values ('company', '20000000-0000-4000-8000-000000000001', 'Master F', 'master-f')$$,
  'P0001', 'В компании может быть не более пяти активных страниц мастеров',
  'A sixth active company page is rejected'
);
update public.masters set is_active = false where id = '30000000-0000-4000-8000-000000000005';
select extensions.lives_ok(
  $$insert into public.masters (id, kind, company_id, display_name, slug)
    values ('30000000-0000-4000-8000-000000000007', 'company',
      '20000000-0000-4000-8000-000000000001', 'Master F', 'master-f')$$,
  'A new active page is allowed after one page is deactivated'
);

-- Availability uses the opening-time-anchored 15-minute grid and master timezone.
select extensions.ok(
  exists (
    select 1 from public.get_available_slots(
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      (now() at time zone 'UTC')::date + 2
    ) s
    where s.slot_start = (((now() at time zone 'UTC')::date + 2)::timestamp + time '09:10') at time zone 'UTC'
  ),
  'First slot aligns to 09:10 opening time'
);

-- Successful bookings persist snapshots and unify clients by E.164 phone.
select extensions.isnt(
  public.create_booking(
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    (((now() at time zone 'UTC')::date + 2)::timestamp + time '09:10') at time zone 'UTC',
    'Client One', '+358401234599', true
  ),
  null::uuid, 'A valid booking is created'
);
select extensions.is(
  (select service_name_snapshot from public.bookings
   where master_id = '30000000-0000-4000-8000-000000000001' limit 1),
  'Consultation', 'Booking stores the service name snapshot'
);
select extensions.isnt(
  public.create_booking(
    '30000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    (((now() at time zone 'UTC')::date + 2)::timestamp + time '09:10') at time zone 'UTC',
    'Client One Updated', '+358401234599', true
  ),
  null::uuid, 'The same client can book another master'
);
select extensions.is(
  (select count(*)::integer from public.clients where phone_e164 = '+358401234599'),
  1, 'The same E.164 phone maps to one client record'
);
select extensions.throws_ok(
  $$select public.create_booking(
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    ((((now() at time zone 'UTC')::date + 2)::timestamp + time '09:10') at time zone 'UTC'),
    'Duplicate Client', '+358401234598', true
  )$$,
  '23P01', null, 'Overlapping confirmed bookings are rejected by the database'
);
select extensions.ok(
  not exists (
    select 1 from public.get_available_slots(
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      (now() at time zone 'UTC')::date + 2
    ) s
    where s.slot_start = (((now() at time zone 'UTC')::date + 2)::timestamp + time '09:10') at time zone 'UTC'
  ),
  'A booked slot disappears from public availability'
);
select extensions.ok(
  exists (
    select 1 from public.get_available_slots(
      '30000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      (now() at time zone 'UTC')::date + 2
    ) s
    where s.slot_start = (((now() at time zone 'UTC')::date + 2)::timestamp + time '09:40') at time zone 'UTC'
  ),
  'The next non-overlapping slot remains available'
);

-- Server-side booking validation rejects invalid lead time, horizon, consent and phone.
select extensions.throws_ok(
  $$select public.create_booking(
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    now() + interval '5 minutes', 'Too Soon', '+358401234597', true
  )$$,
  'P0001', 'До начала записи должно оставаться не менее 10 минут',
  'Minimum ten-minute lead time is enforced'
);
select extensions.throws_ok(
  $$select public.create_booking(
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    now() + interval '31 days', 'Too Far', '+358401234596', true
  )$$,
  'P0001', 'Запись доступна не более чем на 30 дней вперёд',
  'Thirty-day booking horizon is enforced'
);
select extensions.throws_ok(
  $$select public.create_booking(
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    ((((now() at time zone 'UTC')::date + 2)::timestamp + time '10:10') at time zone 'UTC'),
    'No Consent', '+358401234595', false
  )$$,
  'P0001', 'Необходимо подтвердить ознакомление с правилами записи',
  'Booking requires rules acceptance'
);
select extensions.throws_ok(
  $$select public.create_booking(
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    ((((now() at time zone 'UTC')::date + 2)::timestamp + time '10:10') at time zone 'UTC'),
    'Bad Phone', '12345', true
  )$$,
  'P0001', 'Телефон должен быть в формате E.164',
  'Booking requires an E.164 phone number'
);

-- A duration may not cross the end of the local working window or midnight.
insert into public.schedule_exceptions (
  master_id, exception_date, is_day_off, opens_at, closes_at, note
) values (
  '30000000-0000-4000-8000-000000000001',
  (now() at time zone 'UTC')::date + 3,
  false, time '23:30', time '23:59', 'Late window boundary test'
);
select extensions.throws_ok(
  $select public.create_booking(
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    ((((now() at time zone 'UTC')::date + 3)::timestamp + time '23:45') at time zone 'UTC'),
    'Cross Midnight', '+358401234594', true
  )$,
  'P0001', 'Выбранное время вне рабочего расписания',
  'Booking duration cannot cross the end of the working window'
);

-- RLS checks are run as real Postgres API roles with simulated Supabase JWT subjects.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select extensions.is(
  (select count(*)::integer from public.bookings), 2,
  'Company Admin sees bookings for all masters in the company'
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select extensions.is(
  (select count(*)::integer from public.bookings), 1,
  'Employee Master sees only bookings for the assigned master page'
);
select extensions.throws_ok(
  $$select public.cancel_booking((select id from public.bookings
    where master_id = '30000000-0000-4000-8000-000000000001' limit 1))$$,
  'P0001', 'Недостаточно прав для отмены записи',
  'Employee Master cannot cancel bookings'
);
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select extensions.is(
  (select count(*)::integer from public.bookings), 2,
  'Owner sees all bookings'
);

select * from extensions.finish();
rollback;
