/** Semantic version comparison for "0.2.0" vs "0.10.0" style strings.
 * Strips a leading "v", splits on ".", and compares each segment numerically.
 * Missing segments compare as 0, so "1.0" < "1.0.1" and "0.2" > "0.10" (unlike string sort). */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v+/i, '').split('.').map((s) => Number.parseInt(s, 10));
  const pb = b.replace(/^v+/i, '').split('.').map((s) => Number.parseInt(s, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const na = Number.isFinite(pa[i]) ? pa[i]! : 0;
    const nb = Number.isFinite(pb[i]) ? pb[i]! : 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}