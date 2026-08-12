export function initialsOf(displayName: string, email: string): string {
  const source = displayName.trim() || email.split('@')[0] || email;
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const second = words.length > 1 ? (words[1]?.[0] ?? '') : (words[0]?.[1] ?? '');
  return `${first}${second}`.toUpperCase() || '?';
}