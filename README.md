# Nonprofit Caption Generator

Password-protected internal tool for generating social media captions for nonprofit clients, built with Next.js (App Router) and the Claude API. Deploys to Vercel; can be embedded on Squarespace via an iframe.

## How it's put together

- **`app/page.tsx`** — login screen, then the caption-generation form and results. Login is stateless: entering a valid access code stores it in `sessionStorage`, and it's re-sent with every `/api/generate` call (no cookies, no server session). This is also what lets the Squarespace embed work without cross-origin cookie issues.
- **`app/admin/page.tsx`** — separate login gated by the `ADMIN` code, showing per-access-code usage counts.
- **`app/api/generate/route.ts`** — the only route that calls Claude. Validates the access code on every request, builds the prompt server-side, calls the Anthropic Messages API, and increments the usage counter.
- **`lib/pillars.ts`** and **`lib/prompts.ts`** — server-only. These hold the actual pillar descriptions and system/user prompt templates (the "core IP") and are only ever imported from API route files, so they never end up in the client JS bundle. `lib/pillarsPublic.ts` holds just the pillar keys/labels needed to render the Combined-content checkboxes client-side.
- **`lib/usage.ts`** — usage counters, stored in Upstash Redis (see below).

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

- `DEMO2026` — Demo / Preview Access
- `KIRA-MG` — Kira — Maple Grove Rotary
- `ADMIN` (in `lib/accessCodes.ts` as `ADMIN_CODE`) — routes to `/admin` instead of the generator, and is excluded from the usage list.

To add a client, add an entry to `ACCESS_CODES` in `lib/accessCodes.ts`.

## Editing the pillars / prompt

- Pillar labels + descriptions: `lib/pillars.ts`
- Client-visible pillar labels (must stay in sync with the keys/labels in `lib/pillars.ts`, but **no descriptions**): `lib/pillarsPublic.ts`
- System prompt and user-message template: `lib/prompts.ts`
- Model / `max_tokens`: `app/api/generate/route.ts` (currently `claude-sonnet-4-6`, `max_tokens: 1000`)

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
