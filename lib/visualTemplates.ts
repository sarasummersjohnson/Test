// Server-side only. Deterministic pillar -> creative-template mapping for
// the "Visual/Template Needed" Excel column. This is a lookup table, not
// AI-generated — the specific per-post note in "Visual Label" is what the
// model writes; this column only says which of the 6 fixed templates to use.

export const VISUAL_TEMPLATES = {
  SPOTLIGHT: 'Spotlight template',
  EVENT_ASK: 'Event/Ask template',
  IMPACT_STAT: 'Impact/Stat template',
  MYTH_TRUST: 'Myth-bust/Trust template',
  FLEX_GENERAL: 'Flex/General template',
  VIDEO_REEL: 'Video/Reel template',
} as const

const PILLAR_KEY_TO_TEMPLATE: Record<string, string> = {
  // Spotlight template
  spotlight: VISUAL_TEMPLATES.SPOTLIGHT,
  recognition: VISUAL_TEMPLATES.SPOTLIGHT,
  beneficiary: VISUAL_TEMPLATES.SPOTLIGHT,
  // Event/Ask template
  event: VISUAL_TEMPLATES.EVENT_ASK,
  ask: VISUAL_TEMPLATES.EVENT_ASK,
  'sponsor-recruit': VISUAL_TEMPLATES.EVENT_ASK,
  // Impact/Stat template
  impact: VISUAL_TEMPLATES.IMPACT_STAT,
  proof: VISUAL_TEMPLATES.IMPACT_STAT,
  // Myth-bust/Trust template
  myth: VISUAL_TEMPLATES.MYTH_TRUST,
  trust: VISUAL_TEMPLATES.MYTH_TRUST,
  // Flex/General template (also the fallback below)
  'sponsor-thanks': VISUAL_TEMPLATES.FLEX_GENERAL,
}

/** Video/Reel is a manual editorial flag (swap in during review), not auto-assigned. */
export function getVisualTemplate(pillarKey: string): string {
  return PILLAR_KEY_TO_TEMPLATE[pillarKey] ?? VISUAL_TEMPLATES.FLEX_GENERAL
}
