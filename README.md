# Release Night

A release workspace with authentication, ten editable Python test templates, and a Development → Staging → Production pipeline.

## Local setup

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, and supply the Supabase project URL and publishable key. Apply `supabase/migrations/001_release_night.sql` in Supabase’s SQL Editor once. Configure the local authentication site URL as `http://localhost:3000` and allow `http://localhost:3000/auth/confirm`. Run `npm run dev`.

## Release flow

Create a release, open its Release tab, and deploy to Development. Run the suite or individual tests. Passing required tests unlock Staging, and passing Staging tests unlock Production. After Production passes, mark the release shipped. Redeploying, changing the version, or editing the suite invalidates previous verification.

Each release starts with ten Python templates covering availability, signup, login, a core workflow, persistence, API health, resource usage, active users, and traffic routing. Edit scripts, enable or disable checks, choose required checks, or add custom tests.

Execution and environment transitions are simulated: selected tests return passing fixture reports without executing Python or deploying an application. No worker or Docker service is required. Release metadata is stored in Supabase; scripts, deployment history, and results are stored in the current browser, scoped to the signed-in account and release. They do not sync across browsers. Reset workspace clears that release’s local progress.

## Validation and hosting

Run `npm test`, `npm run typecheck`, and `npm run build -- --webpack`. For Vercel, use the Next.js framework preset, set the Supabase variables from `.env.example`, and configure the production URL and `/auth/confirm` callback in Supabase. Only migration 001 is needed for this increment.
