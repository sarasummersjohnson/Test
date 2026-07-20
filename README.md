# Nonprofit Caption Generator

Password-protected internal tool for generating social media captions for nonprofit clients, built with Next.js (App Router) and the Claude API. Deploys to Vercel; can be embedded on Squarespace via an iframe.

## How it's put together

- **`app/page.tsx`** — login screen, then a two-tab UI: **Single batch** (the original form) and **Posting calendar** (see below). Login is stateless: entering a valid access code stores it in `sessionStorage`, and it's re-sent with every API call (no cookies, no server session). This is also what lets the Squarespace embed work without cross-origin cookie issues.
- **`app/admin/page.tsx`** — separate login gated by the `ADMIN` code, showing per-access-code usage counts.
- **`app/api/generate/route.ts`** — single-batch generation. Validates the access code on every request, builds the prompt server-side, calls the Anthropic Messages API, and increments the usage counter.
- **`app/api/generate-calendar/route.ts`** — posting-calendar generation (see below).
- **`app/api/generate-calendar/export/route.ts`** — formats an already-generated calendar into a downloadable `.xlsx`. Pure formatting, no Claude call.
- **`lib/pillars.ts`** and **`lib/prompts.ts`** — server-only. These hold the actual pillar descriptions and system/user prompt templates (the "core IP") and are only ever imported from API route files, so they never end up in the client JS bundle. `lib/pillarsPublic.ts` holds just the pillar keys/labels needed to render the Combined-content checkboxes client-side.
- **`lib/calendarSequencing.ts`** — pure date/pillar-sequencing logic for the posting calendar (no prompt content, so it carries no IP).
- **`lib/excelExport.ts`** — builds the `.xlsx` workbook for calendar downloads.
- **`lib/usage.ts`** — usage counters, stored in Upstash Redis (see below).

## Posting calendar mode

Given a start date, a number of weeks, and posts per week, this generates a full content calendar in one shot instead of one caption at a time:

1. **Sequencing** (`lib/calendarSequencing.ts`, runs server-side before any model call): dates are spread evenly across each week (e.g. at 2/week, posts land ~3-4 days apart); pillars are assigned in a repeating membership/membership/donor pattern — an exact 2:1 ratio for post counts divisible by 3, close to it otherwise — and the same specific pillar is never assigned to two posts in a row.
2. **One batched Claude call**: every post's date + pillar is included in a single prompt, and the model returns a JSON array of `{index, caption}` for the whole calendar at once — not one API call per post. This keeps voice consistent across the batch and is far cheaper than N separate calls. `max_tokens` scales with the number of posts (roughly 130 tokens/post + overhead, capped at 8000) so longer calendars don't get truncated.
3. **Excel export**: the generated posts (already in the browser, no re-generation) are POSTed to `/api/generate-calendar/export`, which returns an `.xlsx` with columns **Date, Pillar, Track, Visual Label, Visual/Template Needed, Caption, Notes** — one row per post, matching the existing client-delivery template. `Visual Label`, `Visual/Template Needed`, and `Notes` are left blank on export (creative-asset selection is a manual step); everything else is filled in. See `lib/excelExport.ts` if the template ever changes.

**Validation:** Posts per week is clamped to **1–5** (default 2) both client-side (as you type, with an inline message if you go out of range) and server-side (the API rejects out-of-range or non-integer values even if a client bypasses the UI). Number of weeks is similarly bounded to **1–13** (a fiscal quarter — 52-week year / 4) — this cap exists because the whole calendar is generated in a single non-streaming API call, and an unbounded calendar length risks truncated output or a request that runs long enough to hit a serverless function timeout. Both bounds live at the top of `app/api/generate-calendar/route.ts` if you want to change them.

## Environment variables

Copy `.env.example` to `.env.local` for local dev and fill in:

| Variable | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Server-side only, never sent to the browser. |
| `ALLOWED_ORIGIN` | For cross-origin embeds | Comma-separated list of origins allowed to call `/api/generate` directly via `fetch` (e.g. your Squarespace domain). Leave blank locally — same-origin and iframe usage work regardless. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | For usage tracking | See below. If unset, caption generation still works — usage just won't be recorded, and `/admin` will show all zeros. |

### Usage tracking storage

Vercel's serverless functions have an ephemeral, largely read-only filesystem, so a plain local JSON file won't reliably persist counts in production. This project uses **Upstash Redis** instead (Vercel KV was sunset as a standalone product; Upstash via the Vercel Marketplace is the current recommended replacement and has the same free-tier shape).

To set it up:
1. In the Vercel dashboard, go to your project → **Storage** → **Marketplace Database Providers** → add **Upstash** (Redis).
2. Vercel injects the connection env vars into your project automatically (`KV_REST_API_URL` / `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` depending on how the integration names them — `lib/usage.ts` checks both).
3. For local dev, create a free database directly at [upstash.com](https://upstash.com) and paste its REST URL/token into `.env.local`.

## Access codes

Hardcoded in `lib/accessCodes.ts` for now (no database):

- `DEMO2026` — Demo / Preview Access. Standing testing/preview code, not a consultant slot.
- `CONSULT-1` through `CONSULT-5` — consultant slots. `CONSULT-1` is Kira at Maple Grove Rotary (renamed from the old `KIRA-MG` code, same person); `CONSULT-2`–`CONSULT-5` are unassigned and ready to hand out.
- `ADMIN` (in `lib/accessCodes.ts` as `ADMIN_CODE`) — routes to `/admin` instead of the generator, and is excluded from the usage list.

To add a 6th consultant, add one line to `ACCESS_CODES` in `lib/accessCodes.ts`.

## Editing the pillars / prompt

- Pillar labels + descriptions: `lib/pillars.ts`
- Client-visible pillar labels (must stay in sync with the keys/labels in `lib/pillars.ts`, but **no descriptions**): `lib/pillarsPublic.ts`
- System prompt and user-message template: `lib/prompts.ts`
- Model / `max_tokens`: `app/api/generate/route.ts` (currently `claude-sonnet-4-6`, `max_tokens: 1000`)

### "Details to include" field

Both forms have an optional **Details to include** field — free text for real names, quotes, or numbers (e.g. answers from a client intake survey) that should actually appear in the captions. Without it, the model either writes generically or inserts a `[STAT]` placeholder rather than inventing a number (per the system prompt). With it, the prompt tells the model to pull whichever detail best fits each pillar and never invent beyond what's provided — see the "Details to draw from" block in `buildUserMessage`/`buildCalendarUserMessage` in `lib/prompts.ts`.

## Local development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Set `ANTHROPIC_API_KEY` in the Vercel project's environment variables.
3. Add the Upstash storage integration (see above) so usage tracking works in production.
4. Once you know your Squarespace domain, set `ALLOWED_ORIGIN` to it (e.g. `https://www.yourorg.org`) and redeploy.

## Embedding on Squarespace

Add a Code Block with:

```html
<iframe
  src="https://your-app.vercel.app"
  style="width:100%; min-height:900px; border:0;"
  title="Caption Generator"
></iframe>
```

Because the iframe's content is served from your Vercel domain, its `fetch` calls to `/api/generate` are same-origin from the iframe's point of view — CORS isn't actually required for this setup. `ALLOWED_ORIGIN` is there in case you later want a lighter-weight widget on the Squarespace page itself that calls `/api/generate` directly via `fetch` instead of embedding the whole app.
