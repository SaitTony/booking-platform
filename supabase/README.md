# Supabase — Workflows

Supabase backend for the Workflows application.

## Project

- Project name: `workflows-DB`
- Project ref: `cetcxttaqtberrntsntr`
- API URL: `https://cetcxttaqtberrntsntr.supabase.co`
- Hosted schema: PostgreSQL, schema `public`
- Frontend: GitHub Pages at `https://saittony.github.io/workflows/`

Never expose the Supabase service-role/secret key to the browser or commit it to Git. The frontend uses the project's publishable key.

## Authentication settings

The current staff login flow uses **email + password**:
- Enable Email sign-in.
- Disable Phone sign-in as an authentication provider.
- Disable email confirmation for the Owner-provisioned staff workflow.
- Keep public sign-up and anonymous sign-in disabled.
- Staff accounts are created only by the Owner Edge Function.
- The phone number is stored as a contact field in E.164 format `+7XXXXXXXXXX`; it is not the login identifier.

**Security setting still requiring Dashboard action:** enable **Leaked Password Protection** in Authentication → Settings → Password Security. The connected Supabase tools do not expose this Auth setting for direct update. After enabling it, run the Security Advisor again.

## Database and migrations

The hosted project currently has 24 applied migrations. The canonical migration files are in `supabase/migrations`; their 14-digit versions must match the versions returned by Supabase migration history.

Rules:
1. Never rerun an already applied migration.
2. Never edit an already-applied migration to change hosted schema.
3. Add each future schema change as a new migration.
4. Before a production migration, run the local disposable Supabase CI workflow and review the SQL.
5. Keep migration files and the hosted `supabase_migrations.schema_migrations` history synchronized.

The current schema has 11 principal public tables:
`profiles`, `companies`, `company_members`, `masters`, `services`, `working_hours`, `schedule_exceptions`, `booking_settings`, `clients`, `bookings`, `booking_status_history`.

RLS is enabled on all these tables. Foreign keys, uniqueness rules, CHECK constraints and indexes enforce core data integrity. Confirmed booking overlap is prevented by the `bookings_no_overlap` exclusion constraint; do not replace it with a frontend-only check or add a duplicate constraint.

The migration set includes:
- initial schema, booking constraints and RLS;
- email/password authentication and phone validation;
- Owner bootstrap and account/page lifecycle safeguards;
- company deletion/archive behavior;
- unique active individual Master_pro page names;
- reserved company slugs, FK/index improvements, timestamp triggers, consolidated RLS policies, relocation of btree_gist to the non-exposed extensions schema, and isolation of SECURITY DEFINER access helpers in the non-exposed private schema.

## Edge Functions

All eight functions are deployed with JWT verification enabled:

- `create-user`
- `assign-user-role`
- `change-password`
- `owner-reset-access`
- `owner-set-account-status`
- `owner-delete-user`
- `owner-update-account-name`
- `owner-delete-company`

The deployment workflow is `.github/workflows/deploy-create-user.yml`. It deploys the full function set when any function source, the workflow, or relevant deployment configuration changes. The Supabase CLI version is pinned to 3.0.0 in that workflow.

Owner-only functions verify the caller's JWT and then verify the active Owner profile server-side. Do not trust role or company identifiers supplied by the frontend.

## Required Edge Function secrets

Supabase supplies the project URL and API keys to Edge Functions. Verify that these environment variables are present:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGIN=https://saittony.github.io`

The shared helper `supabase/functions/_shared/auth.ts` constructs anonymous and service-role clients and validates Owner access. Do not copy service-role credentials into GitHub source or Vite environment variables.

## First Owner bootstrap

For a new environment only:

1. In Supabase Dashboard → Authentication → Users, create the first user with email and a strong temporary password; enable Auto Confirm User.
2. Supply `full_name` and `phone_e164` user metadata. The contact phone must match `+7` plus 10 digits.
3. The database trigger creates a profile with the safe `pending` role.
4. In SQL Editor, replace the placeholder with the exact Owner email and run:

```sql
update public.profiles
set platform_role = 'owner'
where lower(email) = lower('owner@example.com')
returning id, full_name, email, phone_e164, platform_role, force_password_change;
```

5. Verify exactly one row was returned and `force_password_change = true`.
6. Sign in at `/workflows/admin` using the email and temporary password, then complete the forced password change.

Never create a public endpoint that lets a user promote their own profile to Owner.

## Frontend environment

For local development, configure:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The GitHub Pages workflow currently supplies the project URL and publishable key to the Vite build. Publishable keys are intended for browser use and rely on RLS. Service-role keys must never be included.

## Local and CI validation

CI runs on GitHub-hosted runners:
1. Node.js 22 installs the pinned frontend dependency tree.
2. TypeScript and Vite build the frontend.
3. Supabase CLI 3.0.0 starts a disposable local Supabase stack.
4. `supabase db reset` applies all repository migrations to a clean local database.
5. `supabase test db` runs pgTAP tests.
6. Deno type-checks all eight Edge Functions.
7. The disposable local stack is stopped.

The local stack is not the hosted `workflows-DB` project and does not create a paid Supabase branch.

Commands for a developer workstation (requires Docker Desktop, Node.js 22, Supabase CLI 3.0.0 and Deno):

```bash
npm ci
npm run build
supabase start
supabase db reset
supabase migration list
supabase test db
deno check supabase/functions/create-user/index.ts
deno check supabase/functions/assign-user-role/index.ts
deno check supabase/functions/change-password/index.ts
deno check supabase/functions/owner-reset-access/index.ts
deno check supabase/functions/owner-set-account-status/index.ts
deno check supabase/functions/owner-delete-user/index.ts
deno check supabase/functions/owner-update-account-name/index.ts
deno check supabase/functions/owner-delete-company/index.ts
supabase stop --no-backup
```

Do not point destructive local commands at the hosted project. Use the exact project ref only for explicitly reviewed remote operations.

## Current product gaps

- Master_pro Builder is still a local interactive prototype; it does not persist data.
- Photo and cover URL fields exist, but image upload to Supabase Storage is not implemented.
- The `booking_settings.rules_text` field exists; an editable settings interface is not yet available.
- PostHog project exists, but frontend SDK and event instrumentation are not connected.
- Leaked Password Protection must still be enabled in the Supabase Dashboard.
