// Server-side only — never import this from a client component.

import type { Pillar } from './pillars'

export const SYSTEM_PROMPT = `You write social media captions for volunteer-run nonprofits using a fixed content-pillar framework. Voice: warm, specific, plain language, no corporate jargon, no more than 3 sentences per caption, no hashtags, no emoji. Always end with a soft, natural call to action appropriate to the pillar (join/attend/give/learn more), never pushy. Do not invent specific dollar figures, percentages, or statistics that weren't provided in the input — use a placeholder like [STAT] instead if a number is needed but not given.`

export type CaptionRequestInput = {
  orgName: string
  missionStatement?: string
  event?: string
  toneNote?: string
}

function fallbackFields(input: CaptionRequestInput) {
  return {
    mission:
      input.missionStatement?.trim() ||
      'Not provided — infer something reasonable and general for a community nonprofit.',
    event:
      input.event?.trim() || 'None specified — do not reference a specific event or campaign.',
    tone: input.toneNote?.trim() || 'Warm and community-focused (default).',
  }
}

export function buildUserMessage(input: CaptionRequestInput, pillars: Pillar[]): string {
  const { mission, event, tone } = fallbackFields(input)

  const pillarList = pillars
    .map((pillar) => `- ${pillar.label} (${pillar.key}): ${pillar.description}`)
    .join('\n')

  return `Organization: ${input.orgName}
Mission: ${mission}
Upcoming event/campaign: ${event}
Tone note: ${tone}

Generate one complete, ready-to-post caption for each of the following content pillars. Each caption must be the full text a social media manager would copy and paste directly into a post — never a headline, title, summary, or description of what the caption should say. Ground each caption specifically in that pillar's description below, not just its name.
${pillarList}

Respond ONLY with a JSON array, no markdown code fences, no preamble or explanation. Each item must be shaped as: {"pillar": "<pillar key>", "caption": "<caption text>"}`
}

export type CalendarPostInput = {
  index: number
  date: string
  pillar: Pillar
}

/**
 * One batched prompt covering every scheduled post, so the model can keep
 * voice/tone coherent across the whole calendar and we pay for a single
 * request instead of one call per post. The model only needs to echo back
 * `index` + `caption` — date and pillar are already known server-side, so
 * there's no reason to spend output tokens re-stating them.
 */
export function buildCalendarUserMessage(
  input: CaptionRequestInput,
  posts: CalendarPostInput[],
): string {
  const { mission, event, tone } = fallbackFields(input)

  const postList = posts
    .map(
      (post) =>
        `${post.index}. ${post.date} — ${post.pillar.label} (${post.pillar.key}): ${post.pillar.description}`,
    )
    .join('\n')

  return `Organization: ${input.orgName}
Mission: ${mission}
Upcoming event/campaign: ${event}
Tone note: ${tone}

Generate one complete, ready-to-post caption for each scheduled post below, in order. Each caption must be the full text a social media manager would copy and paste directly into a post — never a headline, title, summary, or description of what the caption should say. Each post is dated and assigned a content pillar — ground the caption specifically in that pillar's description, not just its name. Keep voice and tone consistent across the whole calendar, and avoid repeating the same phrasing or opening line across posts.
${postList}

Respond ONLY with a JSON array, no markdown code fences, no preamble or explanation. Each item must be shaped as: {"index": <post number>, "caption": "<caption text>"}`
}

/**
 * Claude is instructed to return a bare JSON array, but strip an accidental
 * ```json fence defensively in case the model wraps it anyway.
 */
export function parseCaptionsResponse(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim()
  return JSON.parse(cleaned)
}
