import type { CSSProperties } from 'react';

export type DoodleVariant = 'thinking' | 'celebrating' | 'confused';
export type DoodleTone = 'soft-blue' | 'soft-mint' | 'soft-cream' | 'neutral';

interface Props {
  variant: DoodleVariant;
  tone?: DoodleTone;
  size?: number;
  style?: CSSProperties;
  'aria-hidden'?: boolean;
}

const toneFill: Record<DoodleTone, string> = {
  'soft-blue': 'var(--card-blue-soft)',
  'soft-mint': 'var(--card-mint-soft)',
  'soft-cream': 'var(--card-cream-soft)',
  neutral: 'var(--bg-inset)',
};

// Hand-drawn paper mascot — flat soft, no gradient, no neon
export function DoodleIllustration({ variant, tone = 'neutral', size = 160, style, 'aria-hidden': ariaHidden = true }: Props) {
  const fill = toneFill[tone];
  // Scale illustration to size (base 160)
  const scale = size / 160;

  return (
    <div
      aria-hidden={ariaHidden}
      style={{
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <svg
        width={160 * scale}
        height={160 * scale}
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={variant}
        style={{ overflow: 'visible' }}
      >
        {/* soft fill behind paper */}
        <rect x="34" y="18" width="92" height="110" rx="7" fill={fill} opacity="0.14" />

        {/* stack paper - back */}
        <g opacity="0.95" style={{ transform: variant === 'celebrating' ? 'rotate(-2deg)' : variant === 'confused' ? 'rotate(-1deg)' : 'rotate(2deg)', transformOrigin: '80px 75px' }}>
          <rect x="38" y="22" width="88" height="106" rx="6" fill="#fff" stroke="#1c1c1f" strokeWidth="1.7" />
          <rect x="42" y="26" width="88" height="106" rx="6" fill="#fff" stroke="#1c1c1f" strokeWidth="1.7" />
        </g>

        {/* main paper */}
        <g style={{ transform: variant === 'celebrating' ? 'rotate(-3deg)' : 'rotate(1.2deg)', transformOrigin: '80px 75px' }}>
          <rect x="46" y="30" width="84" height="102" rx="6" fill="#fff" stroke="#1c1c1f" strokeWidth="1.7" />
          {/* paper lines */}
          <path d="M58 108 H112" stroke="#1c1c1f" strokeWidth="1.1" strokeLinecap="round" opacity="0.12" />
          <path d="M58 114 H102" stroke="#1c1c1f" strokeWidth="1.1" strokeLinecap="round" opacity="0.12" />
          {/* eyes */}
          <circle cx="72" cy="68" r="11" fill="#fff" stroke="#1c1c1f" strokeWidth="1.6" />
          <circle cx="98" cy="68" r="11" fill="#fff" stroke="#1c1c1f" strokeWidth="1.6" />
          <circle cx="74.5" cy="69.5" r="3.2" fill="#1c1c1f" />
          <circle cx="100.5" cy="69.5" r="3.2" fill="#1c1c1f" />
          <circle cx="73.2" cy="67.2" r="1.1" fill="#fff" />
          <circle cx="99.2" cy="67.2" r="1.1" fill="#fff" />
          {/* mouth variants */}
          {variant === 'thinking' && (
            <>
              <rect x="82" y="84" width="14" height="2.2" rx="1.1" fill="#1c1c1f" />
              <path d="M102 78 Q106 76 108 82" stroke="#1c1c1f" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <circle cx="108.5" cy="83.5" r="1.2" fill="#1c1c1f" />
            </>
          )}
          {variant === 'celebrating' && (
            <path d="M84 86 Q88 90 92 86" stroke="#1c1c1f" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          )}
          {variant === 'confused' && (
            <path d="M83 88 Q88 84 93 88" stroke="#1c1c1f" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          )}
          {/* blush for confused */}
          {variant === 'confused' && (
            <>
              <ellipse cx="62" cy="82" rx="4" ry="2.2" fill="#e8a0a0" opacity="0.35" />
              <ellipse cx="106" cy="82" rx="4" ry="2.2" fill="#e8a0a0" opacity="0.35" />
            </>
          )}
        </g>

        {/* limbs */}
        {variant === 'thinking' && (
          <>
            {/* thinking hand */}
            <path d="M110 84 Q118 80 116 68" stroke="#1c1c1f" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <ellipse cx="116.5" cy="66.5" rx="4.5" ry="4" fill="#fff" stroke="#1c1c1f" strokeWidth="1.5" />
            {/* legs */}
            <path d="M68 132 L62 150" stroke="#1c1c1f" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M98 132 L104 150" stroke="#1c1c1f" strokeWidth="1.7" strokeLinecap="round" />
            <ellipse cx="62" cy="151.5" rx="7" ry="3" fill="#1c1c1f" opacity="0.9" />
            <ellipse cx="104" cy="151.5" rx="7" ry="3" fill="#1c1c1f" opacity="0.9" />
          </>
        )}
        {variant === 'celebrating' && (
          <>
            {/* raised fist */}
            <path d="M118 72 Q126 48 124 32" stroke="#1c1c1f" strokeWidth="1.7" strokeLinecap="round" fill="none" />
            <rect x="120" y="22" width="10" height="12" rx="3" fill="#fff" stroke="#1c1c1f" strokeWidth="1.5" />
            <path d="M122 26 H128" stroke="#1c1c1f" strokeWidth="1.1" strokeLinecap="round" opacity="0.4" />
            {/* other arm */}
            <path d="M46 84 Q36 92 38 108" stroke="#1c1c1f" strokeWidth="1.7" strokeLinecap="round" fill="none" />
            <ellipse cx="38" cy="110" rx="5" ry="4" fill="#fff" stroke="#1c1c1f" strokeWidth="1.5" />
            {/* legs running */}
            <path d="M62 132 Q52 142 48 152" stroke="#1c1c1f" strokeWidth="1.7" strokeLinecap="round" fill="none" />
            <path d="M98 132 Q108 142 112 138" stroke="#1c1c1f" strokeWidth="1.7" strokeLinecap="round" fill="none" />
            <ellipse cx="48" cy="153" rx="7" ry="3" fill="#1c1c1f" opacity="0.9" />
            <ellipse cx="112" cy="140" rx="7" ry="3" fill="#1c1c1f" opacity="0.9" />
          </>
        )}
        {variant === 'confused' && (
          <>
            {/* sitting legs */}
            <ellipse cx="56" cy="140" rx="12" ry="7" fill="#fff" stroke="#1c1c1f" strokeWidth="1.5" />
            <ellipse cx="104" cy="140" rx="12" ry="7" fill="#fff" stroke="#1c1c1f" strokeWidth="1.5" />
            <path d="M56 140 Q56 146 56 152" stroke="#1c1c1f" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
            <path d="M104 140 Q104 146 104 152" stroke="#1c1c1f" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
            {/* hand on cheek */}
            <path d="M110 86 Q116 88 118 96" stroke="#1c1c1f" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <ellipse cx="118.5" cy="98" rx="4.5" ry="5" fill="#fff" stroke="#1c1c1f" strokeWidth="1.5" />
            {/* swirl above head */}
            <path d="M88 16 Q96 10 100 16 Q104 22 96 26 Q88 30 86 22" stroke="#1c1c1f" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.75" />
            <path d="M92 18 Q94 16 96 18" stroke="#1c1c1f" strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.5" />
          </>
        )}

        {/* ground shadow — soft flat */}
        <ellipse cx="82" cy="155" rx="38" ry="4.5" fill="#1c1c1f" opacity="0.08" />
      </svg>
    </div>
  );
}
