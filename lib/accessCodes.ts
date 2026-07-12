export type AccessCode = {
  code: string
  label: string
}

// Hardcoded for now, per the current stage of the project — no database yet.
// To add or change a client's code, edit this list.
export const ACCESS_CODES: AccessCode[] = [
  { code: 'DEMO2026', label: 'Demo / Preview Access' },
  { code: 'KIRA-MG', label: 'Kira — Maple Grove Rotary' },
]

// Grants access to /admin instead of the generator. Kept separate from
// ACCESS_CODES so it never shows up in the usage-tracking list.
export const ADMIN_CODE = 'ADMIN'

export function findAccessCode(code: string): AccessCode | undefined {
  return ACCESS_CODES.find((entry) => entry.code === code)
}
