/**
 * AuthHeroArt — komposisi brand hero panel auth (bukan spot doodle).
 * Meniru ritme referensi (mockup board besar + chip melayang), digambar
 * ulang ala sistem doodle: stroke goyang, tanpa wajah, tanpa teks, tanpa
 * foto. INK/PAPER + var(--*) saja agar lolos guard hex.
 * Fluid: viewBox 0 0 480 560, width 100% (max-width diatur CSS).
 */

const INK = '#1c1c1f';
const PAPER = '#fff';

export function AuthHeroArt() {
  return (
    <svg
      viewBox="0 0 480 560"
      width="100%"
      role="img"
      aria-label="auth-hero"
      style={{ overflow: 'visible', display: 'block', height: 'auto' }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* wash */}
      <ellipse cx="240" cy="300" rx="215" ry="245" fill="var(--accent)" opacity="0.08" />
      <ellipse
        cx="240"
        cy="300"
        rx="215"
        ry="245"
        fill="none"
        stroke={INK}
        strokeWidth="1.2"
        opacity="0.08"
        strokeDasharray="2 7"
        strokeLinecap="round"
      />

      {/* board mockup */}
      <g style={{ transform: 'rotate(-1.5deg)', transformOrigin: '240px 300px' }}>
        <rect x="70" y="120" width="340" height="330" rx="18" fill={PAPER} stroke={INK} strokeWidth="2.5" />
        {/* header bar */}
        <path d="M70 168 H410" stroke={INK} strokeWidth="1.6" opacity="0.35" />
        <circle cx="104" cy="144" r="9" fill="var(--card-mint-soft)" stroke={INK} strokeWidth="1.8" />
        <rect x="122" y="136" width="120" height="14" rx="7" fill={INK} opacity="0.14" />
        {/* columns */}
        <rect x="94" y="190" width="96" height="230" rx="10" fill="var(--bg-inset)" stroke={INK} strokeWidth="1.6" strokeOpacity="0.5" />
        <rect x="202" y="190" width="96" height="230" rx="10" fill="var(--bg-inset)" stroke={INK} strokeWidth="1.6" strokeOpacity="0.5" />
        <rect x="310" y="190" width="76" height="230" rx="10" fill="var(--bg-inset)" stroke={INK} strokeWidth="1.6" strokeOpacity="0.5" />
        {/* cards col 1 */}
        <rect x="104" y="206" width="76" height="52" rx="8" fill={PAPER} stroke={INK} strokeWidth="1.8" />
        <rect x="112" y="218" width="48" height="8" rx="4" fill={INK} opacity="0.22" />
        <rect x="112" y="232" width="60" height="8" rx="4" fill="var(--accent)" opacity="0.65" />
        <rect x="104" y="268" width="76" height="52" rx="8" fill={PAPER} stroke={INK} strokeWidth="1.8" />
        <rect x="112" y="280" width="56" height="8" rx="4" fill={INK} opacity="0.22" />
        <rect x="112" y="294" width="36" height="8" rx="4" fill="var(--status-info)" opacity="0.7" />
        {/* cards col 2 */}
        <rect x="212" y="206" width="76" height="52" rx="8" fill={PAPER} stroke={INK} strokeWidth="1.8" />
        <rect x="220" y="218" width="52" height="8" rx="4" fill={INK} opacity="0.22" />
        <circle cx="228" cy="240" r="6" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.5" />
        <rect x="212" y="268" width="76" height="76" rx="8" fill="var(--card-mint-soft)" stroke={INK} strokeWidth="1.8" />
        <path d="M224 288 l8 8 14 -16" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="224" y="308" width="52" height="8" rx="4" fill={INK} opacity="0.2" />
        {/* cards col 3 */}
        <rect x="318" y="206" width="60" height="44" rx="8" fill={PAPER} stroke={INK} strokeWidth="1.8" strokeDasharray="5 3" />
        <rect x="318" y="260" width="60" height="44" rx="8" fill={PAPER} stroke={INK} strokeWidth="1.8" />
        <rect x="326" y="272" width="44" height="8" rx="4" fill={INK} opacity="0.22" />
      </g>

      {/* floating done pill */}
      <g style={{ transform: 'rotate(-7deg)', transformOrigin: '348px 180px' }}>
        <rect x="298" y="162" width="100" height="40" rx="20" fill="var(--accent)" stroke={INK} strokeWidth="2" />
        <path d="M322 182 l7 7 13 -14" stroke={PAPER} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="344" y="176" width="36" height="9" rx="4.5" fill={PAPER} opacity="0.85" />
      </g>

      {/* presence cursor */}
      <g style={{ transform: 'rotate(6deg)', transformOrigin: '120px 430px' }}>
        <path d="M104 414 L104 452 L114 443 L120 456 L127 453 L121 440 L131 440 Z" fill={PAPER} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      </g>

      {/* avatar-blind presence dots (tanpa wajah) */}
      <circle cx="408" cy="120" r="26" fill={PAPER} stroke={INK} strokeWidth="2" />
      <circle cx="400" cy="116" r="6" fill="var(--card-blue-soft)" stroke={INK} strokeWidth="1.6" />
      <circle cx="414" cy="124" r="6" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.6" />

      {/* envelope chip */}
      <g style={{ transform: 'rotate(5deg)', transformOrigin: '96px 470px' }}>
        <rect x="66" y="448" width="60" height="44" rx="9" fill={PAPER} stroke={INK} strokeWidth="2" />
        <path d="M68 452 L96 472 L124 452" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="121" cy="448" r="10" fill="var(--accent)" stroke={INK} strokeWidth="1.6" />
        <path d="M117 448 h8 M121 444 v8" stroke={PAPER} strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* star sparkles */}
      <path
        d="M52 210 L55 220 L65 223 L55 226 L52 236 L49 226 L39 223 L49 220 Z"
        fill="var(--card-cream-soft)"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M428 330 L430.5 337 L437 340 L430.5 343 L428 350 L425.5 343 L419 340 L425.5 337 Z"
        fill="var(--card-cream-soft)"
        stroke={INK}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M150 500 h10 M155 495 v10" stroke={INK} strokeWidth="1.8" opacity="0.4" strokeLinecap="round" />
      <path d="M360 500 h10 M365 495 v10" stroke={INK} strokeWidth="1.8" opacity="0.4" strokeLinecap="round" />

      {/* ground shadow */}
      <ellipse cx="240" cy="470" rx="150" ry="12" fill={INK} opacity="0.06" />
    </svg>
  );
}
