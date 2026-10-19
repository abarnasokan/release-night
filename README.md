# Release Night

A release workspace with authentication, ten editable Python test templates, and a Development → Staging → Production pipeline.

## Local setup

Use Node.js 22 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, and supply the Supabase project URL and publishable key. Apply `supabase/migrations/001_release_night.sql` in Supabase’s SQL Editor once. Configure the local authentication site URL as `http://localhost:3000` and allow `http://localhost:3000/auth/confirm`. Run `npm run dev`.

## Release flow

Create a release, open its Release tab, and deploy to Development. Run the suite or individual tests. Passing required tests unlock Staging, and passing Staging tests unlock Production. After Production passes, mark the release shipped. Redeploying, changing the version, or editing the suite invalidates previous verification.

Each release starts with ten Python templates covering availability, signup, login, a core workflow, persistence, API health, resource usage, active users, and traffic routing. Edit scripts, enable or disable checks, choose required checks, or add custom tests.

Execution and environment transitions are simulated: selected tests return passing fixture reports without executing Python or deploying an application. No worker or Docker service is required. Release metadata is stored in Supabase; scripts, deployment history, and results are stored in the current browser, scoped to the signed-in account and release. They do not sync across browsers. Reset workspace clears that release’s local progress.

## LLM as judge

After running tests, click **LLM as judge** to review all tests for the selected environment. The review includes disabled checks and missing results, script excerpts, and the current deployment’s saved reports. It returns an overall score out of 100, category scores, strengths, gaps, and next steps. The four categories are coverage (30), assertions (25), result quality (25), and operational coverage (20).

Set `GROQ_API_KEY` on the server (`.env.local` locally or Vercel environment variables). Optionally set `GROQ_MODEL`; the default is `openai/gpt-oss-20b`. Never prefix the API key with `NEXT_PUBLIC_`. Script excerpts and test reports are sent to Groq when the button is clicked; keep secrets out of scripts. Reviews are advisory and do not change promotion gates. A review evaluates suite design and the supplied fixture reports, rather than establishing actual release safety.

Reviews are saved in the browser and scoped to the environment, deployment, suite revision, and current test runs. Reruns, script changes, and redeployments require a new review. Provider failures preserve existing test results. Requests require an authenticated release owner. Best-effort limits per warm server instance are one request every 20 seconds per user, 20 per user per day, and 100 total per day; these counters reset when instances restart and are not a global spending cap.

## Validation and hosting

Run `npm test`, `npm run typecheck`, and `npm run build -- --webpack`. For Vercel, use the Next.js framework preset, set the Supabase variables from `.env.example`, and configure the production URL and `/auth/confirm` callback in Supabase. Only migration 001 is needed for this increment.
