// Server-side only — never import this from a client component.

import type { Pillar } from './pillars'

export const SYSTEM_PROMPT = `You write social media captions for volunteer-run nonprofits using a fixed content-pillar framework. Voice: warm, specific, plain language, no corporate jargon, no more than 3 sentences per caption, no hashtags, no emoji. Always end with a soft, natural call to action appropriate to the pillar (join/attend/give/learn more), never pushy. Do not invent specific dollar figures, percentages, or statistics that weren't provided in the input — use a placeholder like [STAT] instead if a number is needed but not given.`

export type CaptionRequestInput = {
  orgName: string
  missionStatement?: string
  event?: string
  toneNote?: string
  keyFacts?: string
}

function fallbackFields(input: CaptionRequestInput) {
  return {
    mission:
      input.missionStatement?.trim() ||
      'Not provided — infer something reasonable and general for a community nonprofit.',
    event:
      input.event?.trim() || 'None specified — do not reference a specific event or campaign.',
    tone: input.toneNote?.trim() || 'Warm and community-focused (default).',
    keyFacts:
      input.keyFacts?.trim() ||
      'None provided — do not invent specific names, quotes, or numbers; keep captions general instead.',
  }
}

export function buildUserMessage(input: CaptionRequestInput, pillars: Pillar[]): string {
  const { mission, event, tone, keyFacts } = fallbackFields(input)

  const pillarList = pillars
    .map((pillar) => `- ${pillar.label} (${pillar.key}): ${pillar.description}`)
    .join('\n')

  return `Organization: ${input.orgName}
Mission: ${mission}
Upcoming event/campaign: ${event}
Tone note: ${tone}
Details to draw from (real names, quotes, numbers — use only what's given here; if nothing here fits a particular pillar, keep that caption general rather than inventing specifics):
${keyFacts}

Generate one complete, ready-to-post caption for each of the following content pillars. Each caption must be the full text a social media manager would copy and paste directly into a post — never a headline, title, summary, or description of what the caption should say. Ground each caption specifically in that pillar's description below, not just its name — and in whichever provided detail above best fits that pillar, if any does.
${pillarList}

Respond ONLY with a JSON array, no markdown code fences, no preamble or explanation. Each item must be shaped as: {"pillar": "<pillar key>", "caption": "<caption text>"}`
}

export type IndexedCalendarSlot = {
  index: number
  date: string
  phase: string
  eventName?: string
  pillarOptions: Pillar[] // length 1 = fixed; length > 1 = model picks the best fit
  notes?: string
}

const PLATFORM_SPECS = `- caption_x (X/Twitter): 71-100 characters. Punchy, 1-2 hashtags, timely/casual tone.
- caption_tiktok (TikTok): short — well under the 4,000-character cap. Casual, hook-driven. This caption supports the video, it is not standalone — do not write it as a self-contained post.
- caption_instagram (Instagram): 138-150 characters. Hook-first — only about the first 125 characters show before "more" truncates it, so the hook must land in that window. 3-5 hashtags.
- caption_facebook (Facebook): 40-80 characters — shorter than people expect. 0-3 hashtags, direct/community tone.
- caption_linkedin (LinkedIn): 800-1,600 characters. Professional, story- or insight-led.`

/**
 * One batched prompt covering every scheduled post in the event-anchored
 * calendar. Each post gets 5 platform-specific caption variants (same
 * underlying pillar/message, adapted per-platform — not one caption copied
 * five times) plus an AI-written Visual Label note. Voice/pillar-grounding
 * rules mirror buildUserMessage; this adds the platform format spec, the
 * per-post phase/event context, and the model's-judgment pillar choice for
 * ambiguous (post-event spotlight) slots.
 */
export function buildEventCalendarUserMessage(
  input: CaptionRequestInput,
  slots: IndexedCalendarSlot[],
): string {
  const { mission, event, tone, keyFacts } = fallbackFields(input)

  const slotList = slots
    .map((slot) => {
      const context = [slot.phase, slot.eventName].filter(Boolean).join(' — ')
      const pillarText =
        slot.pillarOptions.length === 1
          ? `${slot.pillarOptions[0].label} (${slot.pillarOptions[0].key}): ${slot.pillarOptions[0].description}`
          : `CHOOSE ONE based on this event's details above — ${slot.pillarOptions
              .map((p) => `${p.label} (${p.key}): ${p.description}`)
              .join(' OR ')}`
      const noteText = slot.notes ? ` [${slot.notes}]` : ''
      return `${slot.index}. ${slot.date} [${context}] — ${pillarText}${noteText}`
    })
    .join('\n')

  return `Organization: ${input.orgName}
Mission: ${mission}
Upcoming event/campaign: ${event}
Tone note: ${tone}
Details to draw from (real names, quotes, numbers — use only what's given here; if nothing here fits a particular post, keep that caption general rather than inventing specifics):
${keyFacts}

Generate 5 complete, ready-to-post platform-specific caption variants for each scheduled post below, in order. All 5 variants for a post carry the same underlying pillar/message, adapted to that platform's norms — do not just copy one caption into all five fields. None of the 5 are a headline, title, summary, or description of what the caption should say — each is the actual publish-ready text. Platform specs (character counts are approximate targets, not hard limits):
${PLATFORM_SPECS}

Each post is dated, phased (Pre-Event / Event / Post-Event / Steady-State), and assigned a content pillar — ground every variant specifically in that pillar's description, and in whichever provided detail above best fits it, if any does. Where a post lists multiple pillar choices, pick the one that best matches that event's details and use only that pillar for all 5 variants of that post. Don't reuse the same specific detail (e.g. the same member's name, or the same stat) across multiple posts unless it's the only one available. Keep voice and tone consistent across the whole calendar, and avoid repeating the same phrasing or opening line across posts.

Also write a "visual_label" for each post: one short, specific note on what photo or visual this post needs (e.g. "Photo of Jane at the volunteer day", "Event signage/banner shot"), grounded in the provided details when they apply, otherwise a reasonable general note for that pillar. This is separate from and does not need to mention the template name.
${slotList}

Respond ONLY with a JSON array, no markdown code fences, no preamble or explanation. Each item must be shaped as: {"index": <post number>, "pillar": "<pillar key you used>", "visual_label": "<visual note>", "caption_x": "...", "caption_tiktok": "...", "caption_instagram": "...", "caption_facebook": "...", "caption_linkedin": "..."}`
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
