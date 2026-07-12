// Server-side only. This file must never be imported from a client
// component ("use client") or a file that is — the pillar descriptions are
// the core IP behind the prompt and must never reach the browser bundle.
// Client components should import the label-only list from ./pillarsPublic
// instead.

export type Pillar = {
  key: string
  label: string
  description: string
}

export const MEMBERSHIP_PILLARS: Pillar[] = [
  {
    key: 'spotlight',
    label: 'Member Spotlight',
    description:
      'A short feature on a real member — what drew them in, what keeps them coming back. Belonging over accomplishment.',
  },
  {
    key: 'event',
    label: 'Event Promo',
    description:
      'An event announcement that includes a specific next step for a prospective member, not just an attendee.',
  },
  {
    key: 'impact',
    label: 'Community Impact',
    description:
      'A concrete, specific stat or outcome the organization achieved — makes the abstract mission tangible.',
  },
  {
    key: 'myth',
    label: 'Myth-Busting',
    description:
      'Addresses a common hesitation or misconception a younger prospect might have about joining.',
  },
]

export const DONOR_PILLARS: Pillar[] = [
  {
    key: 'proof',
    label: 'Impact Proof',
    description:
      'Where donor dollars specifically went — a concrete outcome tied to a specific gift or campaign.',
  },
  {
    key: 'recognition',
    label: 'Donor Recognition',
    description: "A real donor's reason for giving — motivation-focused, not just a thank-you.",
  },
  {
    key: 'ask',
    label: 'The Ask',
    description: 'A direct, time-bound giving prompt tied to a specific campaign or deadline.',
  },
  {
    key: 'trust',
    label: 'Transparency / Trust',
    description:
      'Budget stewardship, low overhead, or accountability framing that builds donor confidence.',
  },
]

export const ALL_PILLARS: Pillar[] = [...MEMBERSHIP_PILLARS, ...DONOR_PILLARS]

export type ContentType = 'Membership' | 'Donor' | 'Combined'

/**
 * Membership and Donor content types always generate all four pillars in
 * their set. Combined content type generates only the pillars the caller
 * explicitly selected, from either set.
 */
export function getPillarsForContentType(
  contentType: ContentType,
  selectedKeys: string[] = [],
): Pillar[] {
  if (contentType === 'Membership') return MEMBERSHIP_PILLARS
  if (contentType === 'Donor') return DONOR_PILLARS
  if (contentType === 'Combined') {
    return ALL_PILLARS.filter((pillar) => selectedKeys.includes(pillar.key))
  }
  return []
}
