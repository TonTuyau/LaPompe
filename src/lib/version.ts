// TonTuyau's versions: X.Y.Z, or a pre-release X.Y.Z-alpha.N (counted as X.Y.Z here).

/** Whether `version` is at least `least` (major, minor, patch; a pre-release counts as its version). */
export function atLeast(version: string, least: string): boolean {
  const parse = (v: string) => (v.split('-')[0] ?? '').split('.').map((part) => Number.parseInt(part, 10) || 0)
  const [a, b] = [parse(version), parse(least)]
  for (let i = 0; i < 3; i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return true
}

/** The TonTuyau that can download, so take "Add to TonTuyau". */
export const addingSince = '1.6.0'
