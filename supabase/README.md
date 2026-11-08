# Supabase setup for Booking Space

The frontend is hosted on GitHub Pages. Supabase provides Auth, PostgreSQL, Edge Functions and Storage.

## Before applying migrations

1. Open the intended Supabase project and verify its region and project URL.
2. In Authentication > Sign In / Providers, enable Email sign-in and disable Phone sign-in. Disable email confirmations for this staff-only password workflow; public self-registration must remain disabled.
3. Do not enable anonymous account creation. Staff accounts are created only by the Owner Edge Function.
4. Review the SQL migration files in `supabase/migrations` in ascending filename order. Run them in the Supabase SQL Editor only after reviewing the target project. Do not run them twice.
5. Configure Edge Function secrets. Supabase normally supplies the project URL and service role key to Edge Functions; verify the names exist:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ALLOWED_ORIGIN=https://saittony.github.io`
6. Deploy the functions:
   - `create-user`
   - `assign-user-role`
   - `change-password`
   - `owner-reset-access`

All functions verify the caller's access token and check the Owner role server-side. The service role key must never be exposed to the browser, committed to Git, or placed in a `VITE_*` variable.

## Bootstrap the first Owner

The first Owner must be provisioned through a trusted administrative session, not through a public endpoint.

1. In Supabase Dashboard > Authentication > Users, create a user with the Owner's email and a strong temporary password. Enable **Auto Confirm User**. In User Metadata, set `full_name` and `phone_e164` (E.164 format, e.g. `+358XXXXXXXXX`).
2. The database trigger creates a profile with the safe `pending` role and stores the email and contact phone.
3. In SQL Editor, replace the placeholder with the Owner's exact email and run this one-time statement:

```sql
update public.profiles
set platform_role = 'owner'
where lower(email) = lower('owner@example.com')
returning id, full_name, email, phone_e164, platform_role, force_password_change;
```

4. Verify exactly one row was returned and `force_password_change` is `true`. If zero or more than one row is returned, stop and investigate.
5. Sign in at `/workflows/admin` using that email and temporary password. The first login will require a password change; after changing it, the Owner permissions become active.

Never create an endpoint that lets a user promote their own account to Owner.

## Frontend environment

Copy `.env.example` to a local `.env` for development and set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (or the project's publishable key)

For GitHub Pages builds, add repository Actions secrets with those same names and expose them to the Vite build step. The anon/publishable key is designed for frontend use and is protected by RLS. Do not use the service role key.

## Current implementation status

The initial schema, access-control helpers, booking RPCs, public company/booking pages, staff sign-in, first-login password change, Owner account creation, role assignment, Owner-initiated temporary password reset, company and master page management, service and schedule editing, booking/client workspaces, and role-scoped operational views are present in this branch.

The six core database migrations, security function-grant migration, and email-auth migration have been applied to the hosted Supabase project. The four Edge Functions are deployed with JWT verification enabled. Automated local database smoke tests cover role scoping, the five-page company limit, availability, booking validation, client identity, and booking overlap. Email sign-in settings and the first Owner bootstrap still require the Dashboard steps below. Real-user end-to-end testing is required before production use. Remaining product gaps include photo upload to Supabase Storage, slug-change redirects, PWA support, and an editable booking-rules/settings interface.


## Free local validation (recommended before touching the hosted project)

The repository CI pins Supabase CLI v3.0.0 and validates the backend without creating a paid Supabase branch:

1. GitHub Actions starts a disposable local Supabase stack on its free GitHub-hosted runner.
2. `supabase db reset` applies every migration from a clean local database.
3. The workflow checks migration status, runs the pgTAP functional database tests, and type-checks all four Edge Functions with Deno.
4. The local stack is stopped after the job. It is not your hosted `booking-space` project and does not create an hourly Supabase branch.

You can run the same checks on your own computer for free after installing Docker Desktop, the Supabase CLI and Deno:

```bash
npm install
npm run build
supabase start
supabase db reset
supabase migration list
supabase test db
deno check supabase/functions/create-user/index.ts
deno check supabase/functions/assign-user-role/index.ts
deno check supabase/functions/change-password/index.ts
deno check supabase/functions/owner-reset-access/index.ts
supabase stop --no-backup
```

Do not apply migrations to the hosted project until the local migration and function checks pass and the resulting SQL has been reviewed.
