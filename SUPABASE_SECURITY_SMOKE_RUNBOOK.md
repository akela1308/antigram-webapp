# Supabase Security Smoke Runbook

Use this after applying manual SQL migrations in Supabase production.

## Run

1. Open Supabase SQL Editor.
2. Paste the full contents of `SUPABASE_SECURITY_SMOKE_TESTS.sql`.
3. Run the query.

## Expected Result

Every row should have:

```text
passed = true
status = ok
```

If a row says `needs attention`, do not keep applying unrelated migrations. Fix that failed check first.

## Important Checks

- `public_profiles`, `public_moments`, `my_saved_moments`, `my_notifications`, `highlight_moment_details`, and `admin_moderation_reports` exist.
- `anon` does not have access to private owner/admin views.
- `moments` visibility policies exist and old broad select policies are gone.
- `saved_moments` remains owner-only.
- Stars payment ledger/function/grants exist.
- Storage delete policy exists for cleaning moment files.

## When To Run

- After each manual SQL migration.
- Before deploying a large feature touching photos, notifications, payments, moderation, or identity.
- After changing RLS/storage policies.

## What Not To Do

- Do not paste service role keys into SQL comments or docs.
- Do not grant broad table access to `anon` to make a check pass.
- Do not remove RLS from social/payment tables to work around a client error.
