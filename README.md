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

Deployment buttons create real Vercel builds of the separate `abarnasokan/simple-app` repository in one target Vercel project. Python test execution remains simulated: selected checks produce passing fixture reports without executing their scripts. No Python worker or Docker service is required. The LLM review makes a real provider request when its button is clicked.

Accounts and release metadata are stored in Supabase. Scripts, deployment history, test reports, shipped status, and AI reviews are stored in the current browser, scoped to the account and release. They survive refresh but do not sync across devices or browsers. **Reset workspace** clears that release's local progress; it does not roll back or remove any actual Vercel deployment. Older simulated deployment records do not count toward the connected pipeline.

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

## Connect the simple-app Vercel project

Keep the application source in the separate `simple-app` repository. Create one Vercel project linked to that repository, with `dev` and `staging` branches as Preview deployments and `main` as Production. Set `APP_ENV=dev` and `APP_ENV=staging` as branch-specific Preview variables, and `APP_ENV=prod` in Production. The sample app needs no deployment token.

Add these variables to the **Release Night controller's** Vercel Production environment, then redeploy the controller:

| Variable | Value |
| --- | --- |
| `DEPLOY_VERCEL_TOKEN` | A server-only Vercel access token authorized for the target project's account/team |
| `DEPLOY_VERCEL_PROJECT_ID` | The single simple-app project's ID from its Settings → General page |
| `DEPLOY_VERCEL_TEAM_ID` | The owning Vercel team's ID, if the project belongs to a team |
| `DEPLOY_GITHUB_REPOSITORY` | `abarnasokan/simple-app` (also the default) |
| `DEPLOY_ALLOWED_EMAILS` | Comma-separated, confirmed Release Night account emails allowed to deploy |

Create the token in [Vercel account settings](https://vercel.com/account/settings/tokens). Store it as a secret; never prefix it with `NEXT_PUBLIC_` or put it into browser code. An app URL or health endpoint is not a deployment credential. The project ID always identifies the simple-app target, not the Release Night controller.

Click **Deploy** in Development to build the `dev` branch. The controller records the exact provider deployment ID and displays its queued/building/ready/error state. Tests stay disabled until that build is Ready. After the current required checks pass, deploy Staging; the server pins the preceding deployment's Git commit while using the `staging` branch's Preview configuration. Production uses the same commit with the production branch and target. Each environment card links to the exact deployment URL returned by Vercel. Stable branch and production domains can also be viewed in Vercel.

The controller uses the [Vercel deployment API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment), not a request to the hosted application's URL. It checks the linked GitHub repository, authenticated release access, allowed operator email, deployment metadata, and ready predecessor before starting the next target. Missing configuration disables deployment controls rather than silently generating a simulated deployment.

Provider polling resumes from browser-saved pending jobs after a refresh. A failed request pauses polling with a refresh-status action. A failed or canceled build cannot unlock tests or promotion. Redeploying creates a new deployment ID and requires new test results. No additional database migration is required for this POC.

The POC still stores workflow state and passing test fixtures in the browser. Required-test promotion gates are enforced by the UI; the server checks deployment ownership, release revision, and ready predecessors but does not independently attest those fixture test results. Git-triggered builds and direct Vercel access can bypass the UI gates. This is a deployment integration POC rather than an enforced CI/CD approval system. Shared targets can be updated by other releases or operators; the cards link to immutable deployment URLs so the recorded build remains identifiable. A strict production workflow needs shared durable deployment/test state, concurrency control, and controlled promotion permissions.

Deploy starts have a best-effort per-instance allowance of 24 per operator per day and a 15-second cooldown. These counters do not survive server restarts. Provider failures after a request may leave a real build running; check Vercel before retrying an uncertain start.

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
