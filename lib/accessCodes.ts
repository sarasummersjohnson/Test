export type AccessCode = {
  code: string
  label: string
}

// Hardcoded for now, per the current stage of the project — no database yet.
// DEMO2026 is a standing testing/preview code, not a consultant slot.
// CONSULT-1 through CONSULT-5 are consultant slots — CONSULT-1 is Kira at
// Maple Grove Rotary (renamed from the old KIRA-MG code, same person); 2-5
// are unassigned, ready to hand out. To add a 6th slot, add one line here.
export const ACCESS_CODES: AccessCode[] = [
  { code: 'DEMO2026', label: 'Demo / Preview Access' },
  { code: 'CONSULT-1', label: 'Kira — Maple Grove Rotary' },
  { code: 'CONSULT-2', label: 'Consultant Slot 2 (unassigned)' },
  { code: 'CONSULT-3', label: 'Consultant Slot 3 (unassigned)' },
  { code: 'CONSULT-4', label: 'Consultant Slot 4 (unassigned)' },
  { code: 'CONSULT-5', label: 'Consultant Slot 5 (unassigned)' },
]

// Grants access to /admin instead of the generator. Kept separate from
// ACCESS_CODES so it never shows up in the usage-tracking list.
export const ADMIN_CODE = 'ADMIN'

export function findAccessCode(code: string): AccessCode | undefined {
  return ACCESS_CODES.find((entry) => entry.code === code)
}
