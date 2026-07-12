// Server-side only — never import this from a client component.

import type { Pillar } from './pillars'

export const SYSTEM_PROMPT = `You write social media captions for volunteer-run nonprofits using a fixed content-pillar framework. Voice: warm, specific, plain language, no corporate jargon, no more than 3 sentences per caption, no hashtags, no emoji. Always end with a soft, natural call to action appropriate to the pillar (join/attend/give/learn more), never pushy. Do not invent specific dollar figures, percentages, or statistics that weren't provided in the input — use a placeholder like [STAT] instead if a number is needed but not given.`

export type CaptionRequestInput = {
  orgName: string
  missionStatement?: string
  event?: string
  toneNote?: string
}

export function buildUserMessage(input: CaptionRequestInput, pillars: Pillar[]): string {
  const mission =
    input.missionStatement?.trim() ||
    'Not provided — infer something reasonable and general for a community nonprofit.'
  const event =
    input.event?.trim() || 'None specified — do not reference a specific event or campaign.'
  const tone = input.toneNote?.trim() || 'Warm and community-focused (default).'

  const pillarList = pillars
    .map((pillar) => `- ${pillar.label} (${pillar.key}): ${pillar.description}`)
    .join('\n')

  return `Organization: ${input.orgName}
Mission: ${mission}
Upcoming event/campaign: ${event}
Tone note: ${tone}

Generate one caption for each of the following content pillars:
${pillarList}

Respond ONLY with a JSON array, no markdown code fences, no preamble or explanation. Each item must be shaped as: {"pillar": "<pillar key>", "caption": "<caption text>"}`
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
