import { useState } from 'react';
import { avatarColor } from '../lib/avatar';

function initialsFromName(displayName: string, email?: string): string {
  const source = displayName.trim() || email?.split('@')[0] || email || displayName;
  const words = source.split(/[\s._-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return (words[0]?.[0] ?? '?').toUpperCase();
  const first = words[0]?.[0] ?? '';
  const last = words[words.length - 1]?.[0] ?? '';
  return `${first}${last}`.toUpperCase() || '?';
}

export interface AvatarProps {
  src?: string | null;
  name: string;
  email?: string;
  id: string;
  size?: number;
  rounded?: number;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

/**
 * Avatar — foto profil dengan fallback initials berwarna deterministik.
 * Jika src ada dan load sukses → <img>, jika gagal/kosong → initials dengan background avatarColor(id).
 * referrerPolicy="no-referrer" agar Google/GitHub avatar tidak bocor referrer.
 */
export function Avatar({ src, name, email, id, size = 28, rounded, className, style, alt }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src && !failed);
  const initials = initialsFromName(name, email);
  const bg = avatarColor(id);
  const radius = rounded ?? size / 2;
  const dim: React.CSSProperties = { width: size, height: size, borderRadius: radius };

  if (showImage) {
    return (
      <img
        src={src!}
        alt={alt ?? name}
        width={size}
        height={size}
        className={className}
        style={{ ...dim, objectFit: 'cover', flexShrink: 0, ...style }}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        ...dim,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        color: '#fff',
        fontWeight: 600,
        fontSize: Math.max(9, Math.round(size * 0.38)),
        lineHeight: 1,
        flexShrink: 0,
        userSelect: 'none',
        ...style,
      }}
    >
      {initials.slice(0, 2)}
    </span>
  );
}
