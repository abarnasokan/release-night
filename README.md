# Release Night

A workspace for the checks software engineers perform after a release: can users sign up, does the main workflow still work, and does the application look healthy? Release Night brings those checks into a Development → Staging → Production pipeline, with an LLM review of the test suite and its results.

**[Open the live app →](https://release-night-project.vercel.app)**

Create an account to try the workflow. The hosted POC provides the AI connection, so users do not need their own API key.

## Try it

1. Sign up and sign in, then select **Create release** and enter a name and version.
2. Open the **Release** tab and deploy to **Development**.
3. Open **Tests**, review the starter scripts, and select **Run suite** or run individual tests.
4. Select **LLM as judge** for an overall score, strengths, gaps, and suggested improvements.
5. Once the required Development tests pass, deploy to **Staging** and run its suite. Passing Staging unlocks **Production**.
6. Run the Production suite, then select **Mark release shipped**.

Each environment has its own test results. Redeploying, changing the release version, or editing the test suite invalidates earlier verification. At least one enabled, required test must pass before the next environment can unlock.

## What you can customize

Every release starts with ten editable Python test templates:

| Test | What it checks |
| --- | --- |
| Availability | The application can be reached |
| Signup button | The signup entry point is visible and usable |
| Signup workflow | A new user can complete registration |
| Login workflow | An existing user can sign in |
| Core workflow | The application's main user journey completes |
| Persistence | Saved changes can be retrieved |
| API health | Important API endpoints respond as expected |
| CPU and memory | Resource usage stays within thresholds over an hour |
| Active users | User activity and session health remain healthy |
| Traffic routing | Requests and sessions reach the intended deployment |

Edit scripts, enable or disable tests, choose which tests are required for promotion, or add your own checks.

## LLM as judge

One button reviews the entire suite for the selected environment. The server sends the saved reports, script excerpts, and missing-result statuses to Groq. Disabled checks are included as out of scope. The response contains a summary, strengths, gaps, next steps, and four category scores:

| Category | Maximum score |
| --- | ---: |
| Coverage of user journeys | 30 |
| Quality of assertions | 25 |
| Quality and completeness of results | 25 |
| Operational coverage | 20 |
| **Overall** | **100** |

The application validates the category scores and adds them to calculate the total. The score is advisory and measures suite design and the supplied reports; it is not the pass rate and does not change test results or promotion eligibility. New runs, script edits, version changes, or redeployments require a fresh review.

## How the POC works

Test execution and environment transitions are simulated: selected tests produce passing fixture reports without executing Python or deploying an application. This lets users explore the complete release workflow without a worker or Docker service. The LLM review makes a real provider request when its button is clicked.

Accounts and release metadata are stored in Supabase. Scripts, deployment history, test reports, shipped status, and AI reviews are stored in the current browser, scoped to the account and release. They survive refresh but do not sync across devices or browsers. **Reset workspace** clears that release's local progress.

## Run locally

Use Node.js 22 or newer:

```bash
npm ci
cp .env.example .env.local
```

Set these values in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
| `NEXT_PUBLIC_APP_URL` | Application URL; use `http://localhost:3000` locally |
| `GROQ_API_KEY` | Server-only key for the LLM judge |
| `GROQ_MODEL` | Optional; defaults to `openai/gpt-oss-20b` |

Apply [migration 001](supabase/migrations/001_release_night.sql) once using the Supabase SQL Editor. In Supabase authentication settings, use `http://localhost:3000` as the local Site URL and allow `http://localhost:3000/auth/confirm` as a redirect URL.

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). Authentication and release creation need Supabase; the judge also needs the Groq key. No service-role key or Python worker is required for this workflow. Keep `.env.local` out of Git and never give `GROQ_API_KEY` a `NEXT_PUBLIC_` prefix.

## Hosting and architecture

The app uses Next.js App Router, React, TypeScript, Supabase Auth/PostgreSQL, and Groq. Vercel serves the interface and authenticated API routes. Browser storage holds the POC's per-release workflow state.

For Vercel, select the Next.js framework preset, use `npm run build -- --webpack` as the build command, and add the environment variables above. Set `NEXT_PUBLIC_APP_URL` to your production URL. Configure Supabase's Site URL as that same URL and allow its `/auth/confirm` redirect. Only migration 001 is required for this workflow. Redeploy after changing environment variables.

The judge authenticates the user, checks release access, bounds inputs, validates structured output, and applies a provider timeout. Provider failures preserve test results. Best-effort limits per warm server instance are a 20-second user cooldown, 20 requests per user per day, and 100 total per day. These in-memory counters reset when instances restart and are not a global spending cap. Script excerpts and reports are shared with Groq only when a review is requested; keep secrets out of scripts.

## Validation

```bash
npm test
npm run typecheck
npm run build -- --webpack
```

Tests cover sequential environment gates, separate deployment results, invalidation after edits or redeployments, required and disabled checks, bounded judge inputs, score calculation, and review freshness.
