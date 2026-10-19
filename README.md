# Release Night

A private workspace for creating and tracking versioned application releases.

This first increment includes the Next.js/TypeScript foundation, responsive app
shell, Supabase email/password authentication, session refresh, protected release
list and detail pages, release creation, and the database ownership/mutation layer.
The domain module defines revision-bound readiness rules for subsequent UI work.

## Local setup

Use Node.js 22 or newer:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Set your development Supabase project URL and publishable key in `.env.local`.
Apply `supabase/migrations/001_release_night.sql` once in the Supabase SQL Editor.
Configure Authentication → URL Configuration with Site URL `http://localhost:3000`
and allowed redirect `http://localhost:3000/auth/confirm`.

Open `http://localhost:3000/login`, create an account, confirm email if enabled,
and create a release. The browser uses only the publishable key; all private data
is scoped by authenticated database policies. Never commit `.env.local` or keys.

## Validation

```sh
npm test
npm run typecheck
npm run build -- --webpack
```

Six focused tests cover required-check blockers, optional warnings, stale revisions,
version-back invalidation, and required-flag changes. Build/type checks validate the
application source; live Supabase authentication and database behavior require a
configured development project and are not verified by these unit tests.

## Scope of this increment

The database provides checks and immutable shipping snapshots. Their interactive
verification/promotion UI, environment pipeline, Python script templates, and LLM
suite scoring are subsequent increments and are not included in this commit.
