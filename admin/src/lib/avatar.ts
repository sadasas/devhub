const AVATAR_HUES = [15, 28, 48, 165, 205, 265, 310, 350];

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return 'U';
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  return (((first[0] ?? '') + (last[0] ?? '')) || 'U').toUpperCase();
}

export function avatarColor(userId: string): string {
  const hue = AVATAR_HUES[fnv1a(userId) % AVATAR_HUES.length] ?? 205;
  const light = hue === 265 || hue === 310 || hue === 350 ? 65 : 58;
  return `hsl(${hue} 48% ${light}%)`;
}