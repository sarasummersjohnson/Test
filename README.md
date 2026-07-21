# Nonprofit Caption Generator

Password-protected internal tool for generating social media captions for nonprofit clients, built with Next.js (App Router) and the Claude API. Deploys to Vercel; can be embedded on Squarespace via an iframe.

## How it's put together

- **`app/page.tsx`** — login screen, then a two-tab UI: **Single batch** (the original form) and **Posting calendar** (see below). Login is stateless: entering a valid access code stores it in `sessionStorage`, and it's re-sent with every API call (no cookies, no server session). This is also what lets the Squarespace embed work without cross-origin cookie issues.
- **`app/admin/page.tsx`** — separate login gated by the `ADMIN` code, showing per-access-code usage counts.
- **`app/api/generate/route.ts`** — single-batch generation. Validates the access code on every request, builds the prompt server-side, calls the Anthropic Messages API, and increments the usage counter.
- **`app/api/generate-calendar/route.ts`** — posting-calendar generation (see below).
- **`app/api/generate-calendar/export/route.ts`** — formats an already-generated calendar into a downloadable `.xlsx`. Pure formatting, no Claude call.
- **`lib/pillars.ts`** and **`lib/prompts.ts`** — server-only. These hold the actual pillar descriptions and system/user prompt templates (the "core IP") and are only ever imported from API route files, so they never end up in the client JS bundle. `lib/pillarsPublic.ts` holds just the pillar keys/labels needed to render the Combined-content checkboxes client-side.
- **`lib/calendarSequencing.ts`** — event-anchored date/pillar-sequencing logic for the posting calendar (pillar keys only, no descriptions, so it carries no IP on its own).
- **`lib/visualTemplates.ts`** — deterministic pillar → creative-template lookup (Visual/Template Needed column).
- **`lib/excelExport.ts`** — builds the `.xlsx` workbook for calendar downloads.
- **`lib/usage.ts`** — usage counters, stored in Upstash Redis (see below).

## Posting calendar mode

Given a start date, number of weeks, posts per week, and optionally a list of real events, this generates a full content calendar — dates, pillars, platform-specific captions, and visual guidance — in one shot.

### Pillars

11 total. The original 8 (`lib/pillars.ts`, `MEMBERSHIP_PILLARS`/`DONOR_PILLARS`) plus 3 event-only pillars (`EVENT_PILLARS`) reachable only through the calendar's event-phase engine, never through Single Batch mode's content-type/pillar checkboxes:

- **Beneficiary Story** (`beneficiary`) — a real or anonymized story about who a gift or program helped.
- **Sponsorship Recruitment** (`sponsor-recruit`) — a B2B pitch inviting local businesses to sponsor a specific event.
- **Sponsor Thank-You** (`sponsor-thanks`) — publicly naming and thanking confirmed event sponsors.

### Sequencing (`lib/calendarSequencing.ts`)

Runs entirely server-side before any model call — no Claude involvement in deciding dates/pillars, only in writing the captions once the schedule is fixed.

- **Events** (optional, up to 12, each `{name, date, hasSponsors}`) each get a 3-phase arc built around their real date:
  - *Pre-Event*: Sponsorship Recruitment (if sponsors flagged) at ~90/60/30 days before — touchpoints that would fall before the calendar's start date are dropped rather than shifted, with a note flagging the compressed timeline (attached to another real post for that event if literally none of the three fit); Event Promo at ~7 days before, clamped to the calendar's start date if the event is closer than that.
  - *Event*: one real-time/presence post on the event date itself.
  - *Post-Event*: Sponsor Thank-You (if flagged) ~1 day after; a Spotlight/testimonial ~6 days after, where the model picks whichever of Member Spotlight / Donor Recognition / Beneficiary Story best fits that event's provided details (not hardcoded).
- **Steady-State floor**: any week with no event activity rotates Myth-Busting / [Community Impact, weighted 2:1 over Impact Proof] / The Ask, with the same specific pillar never landing on two posts in a row. Note on the ratio: Myth-Busting (membership) and The Ask (donor) are fixed in this 3-slot cycle, which is already 1:1 on its own — a true 50/50 split on the third slot would cap the whole rotation at 1:1, and an exact 2:1 would require Impact Proof to never appear at all. The 2:1-weighted (not 50/50) alternation is a deliberate compromise leaning membership-heavy without freezing Impact Proof out — adjust the weights in `generateSteadyStateSlots` if you want either extreme instead.
- Weeks containing any event content are owned entirely by that event — no steady-state posts are added on top. Start Date + Number of Weeks still define the calendar's overall span; Posts-per-week governs steady-state cadence specifically.

### Generation

One batched Claude call covers every post. For each post the model writes **5 platform-specific caption variants** (not one caption copy-pasted five times — same underlying pillar/message, adapted per platform) plus one AI-written **Visual Label** (a specific note on what photo/visual that post needs). Platform specs live in `lib/prompts.ts` (`buildEventCalendarUserMessage`):

| Field | Target | Notes |
|---|---|---|
| `caption_x` | 71–100 chars | Punchy, 1-2 hashtags, timely/casual |
| `caption_tiktok` | short, well under 4,000 chars | Hook-driven; supports the video, not standalone |
| `caption_instagram` | 138–150 chars | Hook must land in the first ~125 chars before "more" truncates |
| `caption_facebook` | 40–80 chars | Shorter than expected; 0-3 hashtags, direct/community tone |
| `caption_linkedin` | 800–1,600 chars | Professional, story/insight-led |

`Visual/Template Needed` (which of 6 fixed templates — Spotlight, Event/Ask, Impact/Stat, Myth-bust/Trust, Flex/General, Video/Reel) is a deterministic pillar lookup in `lib/visualTemplates.ts`, not AI-generated — Video/Reel is a manual editorial flag, not auto-assigned. `max_tokens` scales with post count and platform-variant volume (~550 tokens/post, up to 64,000) and the request streams under the hood (`stream().finalMessage()`) so a large calendar can't hit the SDK's non-streaming timeout guard — the API still returns one JSON response either way, no client-side change.

### Excel export

`/api/generate-calendar/export` returns an `.xlsx` with columns **Date, Phase, Pillar, Track, Visual Label, Visual/Template Needed, Caption_X, Caption_TikTok, Caption_Instagram, Caption_Facebook, Caption_LinkedIn, Notes** — one row per post, matching the client-delivery template. `Phase` is Pre-Event / Event / Post-Event / Steady-State. `Notes` carries auto-generated context (which event a post belongs to, compressed-timeline flags) and stays blank for steady-state posts; still human-editable after export.

**Validation:** Posts per week is clamped to **1–5** (default 2), Number of weeks to **1–13** (a fiscal quarter), and Events to **12 max** — all enforced client-side (inline messages) and server-side (the API rejects out-of-range values regardless of what the client sends). Every event's date must fall within the selected Start Date/Weeks span, or the request is rejected with a clear error naming the offending event. Bounds live at the top of `app/api/generate-calendar/route.ts`.

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
