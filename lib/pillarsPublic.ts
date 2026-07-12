// Client-safe pillar metadata — key + label only, no descriptions. This is
// what powers the "which pillars to include" checkboxes for Combined content.
// The actual pillar descriptions used in the prompt live server-side only,
// in ./pillars.ts.

export type PillarOption = {
  key: string
  label: string
}

export const MEMBERSHIP_PILLARS_PUBLIC: PillarOption[] = [
  { key: 'spotlight', label: 'Member Spotlight' },
  { key: 'event', label: 'Event Promo' },
  { key: 'impact', label: 'Community Impact' },
  { key: 'myth', label: 'Myth-Busting' },
]

export const DONOR_PILLARS_PUBLIC: PillarOption[] = [
  { key: 'proof', label: 'Impact Proof' },
  { key: 'recognition', label: 'Donor Recognition' },
  { key: 'ask', label: 'The Ask' },
  { key: 'trust', label: 'Transparency / Trust' },
]
