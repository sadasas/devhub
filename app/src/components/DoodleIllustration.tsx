import type { CSSProperties } from 'react';

export type DoodleVariant =
  | 'empty'
  | 'offline'
  | 'not-found'
  | 'locked'
  | 'broken'
  | 'success'
  | 'receipt'
  | 'calendar'
  | 'bug'
  | 'checklist'
  | 'layers'
  | 'scales'
  | 'flag'
  | 'nodes'
  | 'layout'
  | 'idcard'
  | 'envelope'
  | 'bubble'
  | 'key'
  | 'chart'
  | 'canvas'
  | 'camera'
  | 'table'
  | 'clock'
  | 'box'
  | 'memory'
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'tour-team'
  | 'tour-project'
  | 'tour-plan'
  | 'tour-build'
  | 'tour-decide'
  | 'tour-collab'
  | 'tour-welcome'
  | 'tour-issues'
  | 'tour-tests'
  | 'tour-schema'
  | 'tour-releases'
  | 'tour-api'
  | 'tour-overview';
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

const INK = '#1c1c1f';
const PAPER = '#fff';

// Object-scene doodles — hand-drawn, no faces. Each spot is a small scene:
// organic blob backdrop + main object (wobbly strokes, asymmetric, tilted)
// + 2-3 tiny doodle accents (sparkles, tape, scribbles). Deliberately
// multi-element at 140px so it never reads as a single-glyph icon.
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
        {/* organic blob backdrop — hand feel, not a perfect rect */}
        <ellipse cx="80" cy="80" rx="54" ry="50" fill={fill} opacity="0.16" />
        <ellipse cx="80" cy="80" rx="54" ry="50" fill="none" stroke={INK} strokeWidth="1.1" opacity="0.10" strokeDasharray="1 5" strokeLinecap="round" />

        {variant === 'empty' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 95px' }}>
            {/* open box — wobbly body */}
            <path
              d="M50 72 Q49 96 53 121 Q53 126 58 127 Q80 132 102 127 Q107 126 107 121 Q111 96 110 72 Q80 80 50 72 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            {/* box opening */}
            <ellipse cx="80" cy="74" rx="30" ry="9" fill="var(--bg-inset)" stroke={INK} strokeWidth="1.6" />
            <path d="M56 73 Q80 80 104 73" stroke={INK} strokeWidth="1.1" opacity="0.25" strokeLinecap="round" fill="none" />
            {/* front fold + scribbles */}
            <path d="M80 82 Q79 102 80 124" stroke={INK} strokeWidth="1.2" opacity="0.12" strokeLinecap="round" fill="none" />
            <path d="M62 96 Q70 94 78 96" stroke={INK} strokeWidth="1.6" opacity="0.14" strokeLinecap="round" fill="none" />
            <path d="M62 104 Q72 102 80 104" stroke={INK} strokeWidth="1.6" opacity="0.14" strokeLinecap="round" fill="none" />
            {/* sparkles */}
            <path d="M34 44 h8 M38 40 v8" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M118 48 h8 M122 44 v8" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M122 104 h7 M125.5 100.5 v7" stroke={INK} strokeWidth="1.4" opacity="0.45" strokeLinecap="round" />
            <circle cx="44" cy="112" r="2" fill="var(--accent)" opacity="0.7" />
          </g>
        )}

        {variant === 'offline' && (
          <g>
            {/* socket */}
            <g style={{ transform: 'rotate(-3deg)', transformOrigin: '55px 88px' }}>
              <rect x="40" y="68" width="30" height="40" rx="7" fill={PAPER} stroke={INK} strokeWidth="1.7" />
              <circle cx="50" cy="82" r="2.2" fill={INK} opacity="0.75" />
              <circle cx="60" cy="82" r="2.2" fill={INK} opacity="0.75" />
              <path d="M48 96 Q55 94 62 96" stroke={INK} strokeWidth="1.2" opacity="0.2" strokeLinecap="round" fill="none" />
            </g>
            {/* plug */}
            <g style={{ transform: 'rotate(4deg)', transformOrigin: '108px 88px' }}>
              <rect x="94" y="70" width="28" height="36" rx="8" fill={PAPER} stroke={INK} strokeWidth="1.7" />
              <path d="M94 80 Q87 79 80 81" stroke={INK} strokeWidth="1.7" strokeLinecap="round" fill="none" />
              <path d="M94 96 Q87 97 80 95" stroke={INK} strokeWidth="1.7" strokeLinecap="round" fill="none" />
              <path d="M103 78 Q102 88 103 98" stroke={INK} strokeWidth="1.2" opacity="0.25" strokeLinecap="round" fill="none" />
            </g>
            {/* broken current zigzag */}
            <path
              d="M72 76 L78 86 L70 94 L78 104"
              stroke="var(--status-warn)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="70" cy="72" r="1.6" fill="var(--status-warn)" />
            <circle cx="79" cy="109" r="1.6" fill="var(--status-warn)" opacity="0.7" />
            {/* sparkles */}
            <path d="M40 42 h8 M44 38 v8" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M116 42 h8 M120 38 v8" stroke={INK} strokeWidth="1.4" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'not-found' && (
          <g>
            {/* paper — wobbly */}
            <g style={{ transform: 'rotate(-3deg)', transformOrigin: '78px 80px' }}>
              <path
                d="M52 40 Q76 36 104 40 Q108 40 108 44 Q110 84 106 119 Q106 124 101 124 Q77 127 54 123 Q50 122 50 118 Q48 78 52 40 Z"
                fill={PAPER}
                stroke={INK}
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path d="M62 56 Q74 54 92 57" stroke={INK} strokeWidth="2" opacity="0.14" strokeLinecap="round" fill="none" />
              <path d="M62 66 Q76 64 90 67" stroke={INK} strokeWidth="2" opacity="0.14" strokeLinecap="round" fill="none" />
              <path d="M62 76 Q72 75 82 76" stroke={INK} strokeWidth="2" opacity="0.14" strokeLinecap="round" fill="none" />
              {/* tape corners */}
              <g style={{ transform: 'rotate(-18deg)', transformOrigin: '57px 37px' }}>
                <rect x="46" y="32" width="22" height="10" rx="2" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.1" opacity="0.95" />
              </g>
              <g style={{ transform: 'rotate(18deg)', transformOrigin: '99px 37px' }}>
                <rect x="88" y="32" width="22" height="10" rx="2" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.1" opacity="0.95" />
              </g>
            </g>
            {/* magnifier */}
            <circle cx="104" cy="104" r="23" fill={PAPER} stroke={INK} strokeWidth="1.9" />
            <path d="M92 96 Q96 90 104 89" stroke={INK} strokeWidth="2" opacity="0.25" strokeLinecap="round" fill="none" />
            <path d="M120 120 Q128 128 134 136" stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none" />
            <circle cx="135" cy="137" r="3" fill="var(--accent)" stroke={INK} strokeWidth="1.4" />
            <path d="M34 116 h7 M37.5 112.5 v7" stroke={INK} strokeWidth="1.4" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'locked' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 85px' }}>
            {/* shackle */}
            <path d="M63 78 L63 64 Q63 46 80 46 Q97 46 97 64 L97 78" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M68 66 Q68 54 80 52" stroke={INK} strokeWidth="2" opacity="0.2" strokeLinecap="round" fill="none" />
            {/* body */}
            <rect x="56" y="76" width="48" height="40" rx="9" fill={PAPER} stroke={INK} strokeWidth="1.8" />
            <circle cx="80" cy="92" r="5" fill={INK} />
            <rect x="78" y="95" width="4" height="10" rx="2" fill={INK} />
            {/* key */}
            <g style={{ transform: 'rotate(24deg)', transformOrigin: '118px 124px' }}>
              <circle cx="118" cy="112" r="8" fill={PAPER} stroke={INK} strokeWidth="1.6" />
              <circle cx="118" cy="112" r="2.5" fill="var(--accent)" stroke={INK} strokeWidth="1.2" />
              <path d="M118 120 V140" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
              <path d="M118 132 H124 M118 138 H124" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
            </g>
            {/* sparkles */}
            <path d="M40 48 h8 M44 44 v8" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="122" cy="50" r="2" fill={INK} opacity="0.35" />
          </g>
        )}

        {variant === 'broken' && (
          <g>
            {/* cracked paper */}
            <g style={{ transform: 'rotate(1.5deg)', transformOrigin: '80px 80px' }}>
              <path
                d="M52 36 Q78 32 106 37 Q109 37 109 41 Q111 82 107 121 Q107 125 102 125 Q78 128 55 124 Q51 123 51 119 Q49 77 52 36 Z"
                fill={PAPER}
                stroke={INK}
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M82 38 Q76 52 84 64 Q78 78 86 92 Q78 106 84 123"
                stroke="var(--status-danger)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <path d="M84 64 L92 70" stroke="var(--status-danger)" strokeWidth="1.4" strokeLinecap="round" />
              {/* band-aid across crack */}
              <g style={{ transform: 'rotate(-16deg)', transformOrigin: '80px 84px' }}>
                <rect x="64" y="78" width="32" height="12" rx="6" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.3" />
                <circle cx="76" cy="84" r="1.2" fill={INK} opacity="0.35" />
                <circle cx="80" cy="84" r="1.2" fill={INK} opacity="0.35" />
                <circle cx="84" cy="84" r="1.2" fill={INK} opacity="0.35" />
              </g>
            </g>
            {/* warning triangle */}
            <g>
              <path
                d="M112 92 Q114 90 116 92 L134 124 Q136 128 132 128 L100 128 Q96 128 98 124 Z"
                fill={PAPER}
                stroke={INK}
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path d="M116 104 V114" stroke="var(--status-danger)" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="116" cy="119" r="1.8" fill="var(--status-danger)" />
            </g>
            <path d="M36 44 h8 M40 40 v8" stroke={INK} strokeWidth="1.4" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'success' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 80px' }}>
            {/* medal */}
            <circle cx="80" cy="78" r="30" fill={PAPER} stroke={INK} strokeWidth="1.8" />
            <circle cx="80" cy="78" r="24" fill="var(--accent)" stroke={INK} strokeWidth="1.6" />
            <path d="M69 78 Q74 86 79 89 L93 70" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* ribbon tails */}
            <path d="M68 102 L61 124 L71 119 L79 128 L82 106" fill={PAPER} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
            {/* confetti */}
            <path d="M38 52 L44 58" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
            <path d="M116 46 L122 50" stroke="var(--status-info)" strokeWidth="2" strokeLinecap="round" />
            <path d="M124 92 L130 96" stroke="var(--status-warn)" strokeWidth="2" strokeLinecap="round" />
            <path d="M36 96 L42 98" stroke={INK} strokeWidth="1.6" opacity="0.45" strokeLinecap="round" />
            <circle cx="118" cy="116" r="2" fill="var(--status-info)" />
            <circle cx="42" cy="116" r="2" fill="var(--accent)" opacity="0.8" />
            <path d="M52 34 h7 M55.5 30.5 v7" stroke={INK} strokeWidth="1.4" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {/* ground shadow — soft flat */}
        <ellipse cx="80" cy="148" rx="36" ry="4.5" fill={INK} opacity="0.08" />

        {/* ——— Tour topic spots (Batch 2): same hand language, no faces.
            Drawn bolder (stroke ~2) because they render small (52px). ——— */}
        {variant === 'tour-team' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 85px' }}>
            {/* two abstract figures — heads + shoulders, no faces */}
            <circle cx="62" cy="66" r="13" fill={PAPER} stroke={INK} strokeWidth="2" />
            <path d="M42 118 Q42 96 62 94 Q82 96 82 118" fill={PAPER} stroke={INK} strokeWidth="2" strokeLinecap="round" />
            <circle cx="98" cy="66" r="13" fill={PAPER} stroke={INK} strokeWidth="2" />
            <path d="M80 118 Q80 100 96 97 Q114 99 118 118" fill={PAPER} stroke={INK} strokeWidth="2" strokeLinecap="round" />
            {/* accent scarf on front figure */}
            <path d="M52 84 Q62 90 72 84" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" fill="none" />
            {/* sparkles */}
            <path d="M36 40 h8 M40 36 v8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="122" cy="46" r="2.4" fill={INK} opacity="0.35" />
          </g>
        )}

        {variant === 'tour-project' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 88px' }}>
            {/* folder/box */}
            <path
              d="M44 62 Q44 58 48 58 L68 58 L76 66 L112 66 Q116 66 116 70 L116 118 Q116 122 112 122 L48 122 Q44 122 44 118 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M44 76 Q80 72 116 76" stroke={INK} strokeWidth="1.4" opacity="0.25" strokeLinecap="round" fill="none" />
            {/* hex node badge (logo echo) */}
            <g style={{ transform: 'rotate(-6deg)', transformOrigin: '104px 100px' }}>
              <circle cx="104" cy="100" r="14" fill="var(--accent)" stroke={INK} strokeWidth="1.8" />
              <path d="M104 93 L110 96.5 V103.5 L104 107 L98 103.5 V96.5 Z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
            </g>
            <path d="M38 42 h8 M42 38 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'tour-plan' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 85px' }}>
            {/* mini-kanban: 3 columns */}
            <path
              d="M36 56 Q36 52 40 52 L120 52 Q124 52 124 56 L124 120 Q124 124 120 124 L40 124 Q36 124 36 120 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M66 52 V124 M94 52 V124" stroke={INK} strokeWidth="1.4" opacity="0.3" />
            {/* cards */}
            <rect x="42" y="60" width="18" height="12" rx="3" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.4" />
            <rect x="42" y="76" width="18" height="12" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.4" />
            <g style={{ transform: 'rotate(6deg)', transformOrigin: '80px 70px' }}>
              <rect x="71" y="62" width="18" height="14" rx="3" fill="var(--accent)" stroke={INK} strokeWidth="1.4" />
            </g>
            <rect x="99" y="60" width="18" height="12" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.4" />
            {/* progress dots */}
            <circle cx="48" cy="112" r="2.4" fill="var(--accent)" stroke={INK} strokeWidth="1.2" />
            <circle cx="60" cy="112" r="2.4" fill={PAPER} stroke={INK} strokeWidth="1.2" />
          </g>
        )}

        {variant === 'tour-build' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 88px' }}>
            {/* 3 stacked layers */}
            <path d="M44 92 L80 78 L116 92 L80 106 Z" fill={PAPER} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d="M44 106 L80 92 L116 106 L80 120 Z" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d="M52 78 L80 67 L108 78" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* check badge */}
            <circle cx="106" cy="62" r="13" fill="var(--accent)" stroke={INK} strokeWidth="1.8" />
            <path d="M100 62 L104 66 L112 57" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M36 44 h8 M40 40 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'tour-decide' && (
          <g>
            {/* balance scale */}
            <path d="M80 44 V118" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M52 56 Q80 48 108 56" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M52 56 L44 78 M52 56 L60 78" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M40 78 Q52 86 64 78" fill={PAPER} stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M108 56 L100 78 M108 56 L116 78" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M96 78 Q108 86 120 78" fill="var(--accent)" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            <path d="M62 118 H98" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            {/* sparkle */}
            <path d="M120 36 h8 M124 32 v8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {variant === 'tour-collab' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 80px' }}>
            {/* whiteboard */}
            <path
              d="M40 48 Q40 44 44 44 L116 44 Q120 44 120 48 L120 104 Q120 108 116 108 L44 108 Q40 108 40 104 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* arrow scribble */}
            <path d="M54 88 Q70 70 92 72" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M84 66 L93 72 L86 80" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="102" cy="88" r="3" fill="var(--accent)" stroke={INK} strokeWidth="1.4" />
            <circle cx="62" cy="60" r="2.2" fill="var(--status-info)" />
            {/* stand */}
            <path d="M66 108 L60 128 M94 108 L100 128" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {variant === 'tour-welcome' && (
          <g>
            {/* hub node (logo echo) + orbit sparkles */}
            <g style={{ transform: 'rotate(-4deg)', transformOrigin: '80px 82px' }}>
              <rect x="56" y="58" width="48" height="48" rx="12" fill={PAPER} stroke={INK} strokeWidth="2" />
              <path d="M80 68 L92 75 V89 L80 96 L68 89 V75 Z" fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
              <path d="M80 82 V68 M80 82 L68 89 M80 82 L92 89" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="80" cy="82" r="3.4" fill="var(--accent)" stroke={INK} strokeWidth="1.4" />
            </g>
            {/* orbit */}
            <path d="M44 82 Q44 50 80 46 Q116 50 116 82" stroke={INK} strokeWidth="1.4" opacity="0.3" strokeDasharray="1 5" strokeLinecap="round" fill="none" />
            <circle cx="44" cy="82" r="2.6" fill="var(--accent)" stroke={INK} strokeWidth="1.2" />
            <circle cx="116" cy="82" r="2.6" fill="var(--status-info)" stroke={INK} strokeWidth="1.2" />
            <path d="M118 116 h8 M122 112 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'tour-issues' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 85px' }}>
            {/* ticket card */}
            <path
              d="M46 60 Q46 56 50 56 L110 56 Q114 56 114 60 L114 110 Q114 114 110 114 L50 114 Q46 114 46 110 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M46 78 Q42 82 46 86 M114 78 Q118 82 114 86" stroke={INK} strokeWidth="1.6" fill="none" />
            <path d="M58 72 Q72 70 88 72" stroke={INK} strokeWidth="1.8" opacity="0.16" strokeLinecap="round" fill="none" />
            <path d="M58 100 Q70 98 82 100" stroke={INK} strokeWidth="1.8" opacity="0.16" strokeLinecap="round" fill="none" />
            {/* alert badge */}
            <circle cx="102" cy="96" r="14" fill="var(--status-warn)" stroke={INK} strokeWidth="1.8" />
            <path d="M102 89 V97" stroke={PAPER} strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="102" cy="101" r="1.6" fill={PAPER} />
            <path d="M38 42 h8 M42 38 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'tour-tests' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 85px' }}>
            {/* clipboard */}
            <path
              d="M52 48 Q52 44 56 44 L104 44 Q108 44 108 48 L108 122 Q108 126 104 126 L56 126 Q52 126 52 122 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <rect x="68" y="36" width="24" height="12" rx="4" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.6" />
            {/* checklist rows */}
            <rect x="62" y="60" width="10" height="10" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.6" />
            <path d="M77 65 H100" stroke={INK} strokeWidth="1.8" opacity="0.2" strokeLinecap="round" />
            <rect x="62" y="78" width="10" height="10" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.6" />
            <path d="M77 83 H100" stroke={INK} strokeWidth="1.8" opacity="0.2" strokeLinecap="round" />
            <rect x="62" y="96" width="10" height="10" rx="3" fill={PAPER} stroke={INK} strokeWidth="1.6" />
            <path d="M77 101 H94" stroke={INK} strokeWidth="1.8" opacity="0.2" strokeLinecap="round" />
            {/* checks */}
            <path d="M63 65 L66 68 L72 62" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M63 83 L66 86 L72 80" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        )}

        {variant === 'tour-schema' && (
          <g>
            {/* two linked table boxes */}
            <g style={{ transform: 'rotate(-3deg)', transformOrigin: '60px 70px' }}>
              <rect x="38" y="52" width="44" height="36" rx="6" fill={PAPER} stroke={INK} strokeWidth="2" />
              <path d="M38 64 H82" stroke={INK} strokeWidth="1.4" opacity="0.3" />
              <circle cx="82" cy="76" r="3" fill="var(--accent)" stroke={INK} strokeWidth="1.4" />
            </g>
            <g style={{ transform: 'rotate(3deg)', transformOrigin: '102px 102px' }}>
              <rect x="80" y="86" width="44" height="36" rx="6" fill={PAPER} stroke={INK} strokeWidth="2" />
              <path d="M80 98 H124" stroke={INK} strokeWidth="1.4" opacity="0.3" />
              <circle cx="80" cy="110" r="3" fill="var(--status-info)" stroke={INK} strokeWidth="1.4" />
            </g>
            {/* relation line */}
            <path d="M85 79 Q94 84 90 92" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" strokeDasharray="4 3" />
            <path d="M38 116 h8 M42 112 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'tour-releases' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 85px' }}>
            {/* milestone flag */}
            <path d="M58 40 V124" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <path
              d="M58 42 Q78 38 98 44 L98 72 Q78 66 58 70 Z"
              fill="var(--accent)"
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* tag */}
            <g style={{ transform: 'rotate(-8deg)', transformOrigin: '96px 106px' }}>
              <path d="M82 96 L108 96 L118 106 L108 116 L82 116 Q78 116 78 112 L78 100 Q78 96 82 96 Z" fill={PAPER} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
              <circle cx="86" cy="106" r="2" fill={INK} opacity="0.5" />
              <path d="M94 102 H108" stroke={INK} strokeWidth="1.6" opacity="0.3" strokeLinecap="round" />
            </g>
            <path d="M50 124 H70" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
          </g>
        )}

        {variant === 'tour-api' && (
          <g>
            {/* endpoint nodes */}
            <circle cx="52" cy="62" r="11" fill={PAPER} stroke={INK} strokeWidth="2" />
            <circle cx="52" cy="106" r="11" fill={PAPER} stroke={INK} strokeWidth="2" />
            <circle cx="108" cy="84" r="15" fill={PAPER} stroke={INK} strokeWidth="2" />
            <path d="M101 77 L112 84 L101 91" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* connectors */}
            <path d="M63 62 Q86 62 93 76" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" strokeDasharray="4 3" />
            <path d="M63 106 Q86 106 93 92" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" strokeDasharray="4 3" />
            {/* method chips */}
            <rect x="42" y="56" width="20" height="12" rx="6" fill="var(--accent)" stroke={INK} strokeWidth="1.4" />
            <rect x="42" y="100" width="20" height="12" rx="6" fill="var(--status-info)" stroke={INK} strokeWidth="1.4" />
          </g>
        )}

        {variant === 'tour-overview' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 90px' }}>
            {/* chart card */}
            <path
              d="M42 52 Q42 48 46 48 L114 48 Q118 48 118 52 L118 120 Q118 124 114 124 L46 124 Q42 124 42 120 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* bars */}
            <rect x="54" y="96" width="12" height="16" rx="2" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.5" />
            <rect x="72" y="86" width="12" height="26" rx="2" fill="var(--status-info)" stroke={INK} strokeWidth="1.5" />
            <rect x="90" y="74" width="12" height="38" rx="2" fill="var(--accent)" stroke={INK} strokeWidth="1.5" />
            {/* trend */}
            <path d="M54 92 Q72 84 80 78 Q92 70 106 64" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" strokeDasharray="4 3" />
            <circle cx="106" cy="64" r="2.6" fill="var(--accent)" stroke={INK} strokeWidth="1.2" />
          </g>
        )}

        {variant === 'receipt' && (
          <g style={{ transform: 'rotate(3deg)', transformOrigin: '80px 90px' }}>
            {/* receipt slip with zigzag bottom */}
            <path
              d="M52 44 Q52 40 56 40 L104 40 Q108 40 108 44 L108 118 L102 112 L96 118 L90 112 L84 118 L78 112 L72 118 L66 112 L60 118 L54 112 L52 114 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* tear line */}
            <path d="M56 56 H104" stroke={INK} strokeWidth="1.4" strokeDasharray="3 3" opacity="0.4" />
            {/* item lines */}
            <path d="M60 70 H100 M60 80 H92 M60 90 H96" stroke={INK} strokeWidth="1.6" opacity="0.3" strokeLinecap="round" />
            {/* coin */}
            <circle cx="106" cy="108" r="14" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="2" />
            <circle cx="106" cy="108" r="7.5" fill="none" stroke={INK} strokeWidth="1.6" opacity="0.55" />
            {/* sparkles */}
            <path d="M38 62 h8 M42 58 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
            <path d="M116 52 h7 M119.5 48.5 v7" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'pending' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 80px' }}>
            {/* hourglass — wobbly frame */}
            <path
              d="M60 48 Q60 44 64 44 L96 44 Q100 44 100 48 L100 58 Q100 70 88 78 Q100 86 100 98 L100 106 Q100 110 96 110 L64 110 Q60 110 60 106 L60 98 Q60 86 72 78 Q60 70 60 58 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* top sand */}
            <path d="M68 52 L92 52 L80 68 Z" fill="var(--status-warn)" opacity="0.85" />
            {/* falling grains */}
            <circle cx="80" cy="78" r="1.8" fill="var(--status-warn)" />
            <circle cx="80" cy="86" r="1.8" fill="var(--status-warn)" />
            {/* bottom mound */}
            <path d="M68 102 Q80 90 92 102 Z" fill="var(--status-warn)" opacity="0.85" />
            {/* sparkles */}
            <path d="M40 62 h8 M44 58 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
            <path d="M112 92 h7 M115.5 88.5 v7" stroke="var(--status-warn)" strokeWidth="1.6" strokeLinecap="round" />
          </g>
        )}

        {variant === 'paid' && (
          <g style={{ transform: 'rotate(-3deg)', transformOrigin: '80px 90px' }}>
            {/* receipt slip with zigzag bottom */}
            <path
              d="M48 46 Q48 42 52 42 L96 42 Q100 42 100 46 L100 116 L94 110 L88 116 L82 110 L76 116 L70 110 L64 116 L58 110 L52 116 L48 112 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* item lines + total rule */}
            <path d="M56 60 H92 M56 70 H84 M56 80 H88" stroke={INK} strokeWidth="1.6" opacity="0.3" strokeLinecap="round" />
            <path d="M56 92 H92" stroke={INK} strokeWidth="1.6" opacity="0.5" />
            {/* stamp badge */}
            <circle cx="106" cy="58" r="15" fill="var(--accent)" stroke={INK} strokeWidth="1.8" />
            <path d="M99 58 L104 63 L114 51" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {/* coin */}
            <circle cx="104" cy="108" r="11" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.8" />
            <circle cx="104" cy="108" r="5.5" fill="none" stroke={INK} strokeWidth="1.4" opacity="0.55" />
            {/* sparkle */}
            <path d="M34 84 h8 M38 80 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'cancelled' && (
          <g style={{ transform: 'rotate(3deg)', transformOrigin: '80px 85px' }}>
            {/* top half — torn bottom edge */}
            <path
              d="M52 42 Q52 38 56 38 L104 38 Q108 38 108 42 L108 74 L102 68 L96 74 L90 68 L84 74 L78 68 L72 74 L66 68 L60 74 L54 68 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* item lines top */}
            <path d="M60 52 H100 M60 60 H92" stroke={INK} strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
            {/* bottom half — slipped down, torn top edge */}
            <path
              d="M58 94 L64 88 L70 94 L76 88 L82 94 L88 88 L94 94 L100 88 L106 94 L110 90 L110 118 Q110 122 106 122 L62 122 Q58 122 58 118 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* X across the tear */}
            <path d="M68 78 L96 106 M96 78 L68 106" stroke="var(--status-danger)" strokeWidth="3" strokeLinecap="round" />
            {/* paper scrap */}
            <path d="M118 104 L130 100 L124 112 Z" fill={PAPER} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
            {/* sparkle */}
            <path d="M36 88 h8 M40 84 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'calendar' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 90px' }}>
            {/* page */}
            <path
              d="M44 54 Q44 50 48 50 L112 50 Q116 50 116 54 L116 122 Q116 126 112 126 L48 126 Q44 126 44 122 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* binding rings */}
            <path d="M62 43 V57 M98 43 V57" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
            {/* header rule */}
            <path d="M44 70 H116" stroke={INK} strokeWidth="1.6" opacity="0.5" />
            {/* circled date */}
            <circle cx="80" cy="98" r="13" fill="var(--accent)" stroke={INK} strokeWidth="2" />
            {/* grid dots */}
            <circle cx="58" cy="96" r="2" fill={INK} opacity="0.3" />
            <circle cx="58" cy="110" r="2" fill={INK} opacity="0.3" />
            <circle cx="102" cy="96" r="2" fill={INK} opacity="0.3" />
            <circle cx="102" cy="110" r="2" fill={INK} opacity="0.3" />
            {/* sparkles */}
            <path d="M34 84 h8 M38 80 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
            <path d="M120 108 h7 M123.5 104.5 v7" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'bug' && (
          <g style={{ transform: 'rotate(-3deg)', transformOrigin: '80px 90px' }}>
            {/* beetle shell */}
            <ellipse cx="78" cy="92" rx="26" ry="30" fill={PAPER} stroke={INK} strokeWidth="2" />
            {/* shell split */}
            <path d="M78 62 V122" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            {/* head plate */}
            <path d="M64 66 Q78 56 92 66 L90 74 Q78 68 66 74 Z" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            {/* legs */}
            <path d="M54 80 L42 74 M54 94 L40 94 M54 108 L42 114 M102 80 L114 74 M102 94 L116 94 M102 108 L114 114" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            {/* shell dots */}
            <circle cx="70" cy="92" r="2.4" fill={INK} opacity="0.45" />
            <circle cx="86" cy="102" r="2.4" fill={INK} opacity="0.45" />
            {/* sparkles */}
            <path d="M116 56 h8 M120 52 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'checklist' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 90px' }}>
            {/* clipboard */}
            <path
              d="M50 52 Q50 48 54 48 L106 48 Q110 48 110 52 L110 124 Q110 128 106 128 L54 128 Q50 128 50 124 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* clip */}
            <rect x="68" y="40" width="24" height="14" rx="4" fill="var(--card-mint-soft)" stroke={INK} strokeWidth="1.8" />
            {/* rows */}
            <rect x="60" y="64" width="12" height="12" rx="2" fill="none" stroke={INK} strokeWidth="1.6" />
            <path d="M61 70 L65 74 L73 65" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M78 70 H100" stroke={INK} strokeWidth="1.6" opacity="0.3" strokeLinecap="round" />
            <rect x="60" y="84" width="12" height="12" rx="2" fill="none" stroke={INK} strokeWidth="1.6" />
            <path d="M61 90 L65 94 L73 85" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M78 90 H100" stroke={INK} strokeWidth="1.6" opacity="0.3" strokeLinecap="round" />
            <rect x="60" y="104" width="12" height="12" rx="2" fill="none" stroke={INK} strokeWidth="1.6" strokeDasharray="3 2" opacity="0.6" />
            <path d="M78 110 H96" stroke={INK} strokeWidth="1.6" opacity="0.3" strokeLinecap="round" />
            {/* sparkle */}
            <path d="M122 70 h8 M126 66 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'layers' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 90px' }}>
            {/* stacked slabs */}
            <path d="M44 84 L80 66 L116 84 L80 102 Z" fill={PAPER} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d="M44 102 L80 84 L116 102 L80 120 Z" fill="var(--card-blue-soft)" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
            <path d="M52 66 L80 52 L108 66" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* top slab accent */}
            <circle cx="80" cy="84" r="4" fill="var(--accent)" stroke={INK} strokeWidth="1.4" />
            {/* sparkles */}
            <path d="M36 108 h8 M40 104 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
            <path d="M118 56 h7 M121.5 52.5 v7" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'scales' && (
          <g>
            {/* beam */}
            <path d="M80 44 V118" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M48 56 L112 56" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            <circle cx="80" cy="56" r="3" fill={INK} />
            {/* left pan */}
            <path d="M48 56 L38 84 M48 56 L58 84" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M32 84 Q48 92 64 84 L60 96 Q48 102 36 96 Z" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            {/* right pan */}
            <path d="M112 56 L102 84 M112 56 L122 84" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
            <path d="M96 84 Q112 92 128 84 L124 96 Q112 102 100 96 Z" fill={PAPER} stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
            {/* base */}
            <path d="M66 118 H94" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            {/* sparkle */}
            <path d="M122 108 h8 M126 104 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'flag' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 85px' }}>
            {/* pole */}
            <path d="M62 38 V126" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="62" cy="36" r="3.4" fill="var(--accent)" stroke={INK} strokeWidth="1.6" />
            {/* waving flag */}
            <path
              d="M62 42 Q82 36 104 44 L104 74 Q82 66 62 72 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M70 52 Q84 48 96 52" stroke={INK} strokeWidth="1.6" opacity="0.35" strokeLinecap="round" fill="none" />
            {/* star on flag */}
            <path d="M82 56 l2.2 4.4 4.8 0.7 -3.5 3.4 0.8 4.8 -4.3 -2.3 -4.3 2.3 0.8 -4.8 -3.5 -3.4 4.8 -0.7 Z" fill="var(--accent)" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
            {/* ground */}
            <path d="M50 126 H76" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            {/* confetti */}
            <path d="M112 92 l6 3 M40 100 l6 -2" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
            <circle cx="118" cy="70" r="2.2" fill={INK} opacity="0.35" />
          </g>
        )}

        {variant === 'nodes' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 88px' }}>
            {/* hub */}
            <circle cx="80" cy="88" r="16" fill={PAPER} stroke={INK} strokeWidth="2" />
            <circle cx="80" cy="88" r="5" fill="var(--status-info)" stroke={INK} strokeWidth="1.6" />
            {/* satellites */}
            <circle cx="44" cy="60" r="10" fill={PAPER} stroke={INK} strokeWidth="2" />
            <circle cx="116" cy="60" r="10" fill={PAPER} stroke={INK} strokeWidth="2" />
            <circle cx="52" cy="120" r="10" fill={PAPER} stroke={INK} strokeWidth="2" />
            <circle cx="110" cy="120" r="10" fill={PAPER} stroke={INK} strokeWidth="2" />
            {/* links */}
            <path d="M52 66 Q62 74 66 80 M108 66 Q98 74 94 80 M58 112 Q66 102 68 98 M104 112 Q96 102 92 98" stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none" strokeDasharray="4 3" />
            {/* method chips */}
            <rect x="36" y="54" width="16" height="12" rx="6" fill="var(--accent)" stroke={INK} strokeWidth="1.2" />
            <rect x="108" y="54" width="16" height="12" rx="6" fill="var(--status-info)" stroke={INK} strokeWidth="1.2" />
          </g>
        )}

        {variant === 'layout' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 90px' }}>
            {/* template frame */}
            <path
              d="M42 50 Q42 46 46 46 L114 46 Q118 46 118 50 L118 126 Q118 130 114 130 L46 130 Q42 130 42 126 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* hero block */}
            <rect x="52" y="56" width="56" height="30" rx="3" fill="var(--card-blue-soft)" stroke={INK} strokeWidth="1.6" />
            {/* side blocks */}
            <rect x="52" y="92" width="26" height="28" rx="3" fill="none" stroke={INK} strokeWidth="1.6" strokeDasharray="4 2" />
            <rect x="82" y="92" width="26" height="28" rx="3" fill="var(--accent)" stroke={INK} strokeWidth="1.6" />
            {/* text lines */}
            <path d="M52 62 H100 M52 68 H92" stroke={PAPER} strokeWidth="1.6" opacity="0.7" strokeLinecap="round" />
            {/* sparkle */}
            <path d="M122 96 h8 M126 92 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'idcard' && (
          <g style={{ transform: 'rotate(-3deg)', transformOrigin: '80px 90px' }}>
            {/* lanyard */}
            <path d="M80 36 V52" stroke={INK} strokeWidth="2" strokeLinecap="round" />
            <circle cx="80" cy="56" r="4" fill="none" stroke={INK} strokeWidth="1.8" />
            {/* card */}
            <path
              d="M46 62 Q46 58 50 58 L110 58 Q114 58 114 62 L114 120 Q114 124 110 124 L50 124 Q46 124 46 120 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* photo placeholder */}
            <circle cx="66" cy="86" r="11" fill="var(--card-blue-soft)" stroke={INK} strokeWidth="1.8" />
            <path d="M58 108 Q66 100 74 108" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            {/* text lines */}
            <path d="M84 78 H104 M84 88 H104 M84 98 H98" stroke={INK} strokeWidth="1.6" opacity="0.3" strokeLinecap="round" />
            {/* stripe */}
            <path d="M46 110 H114" stroke={INK} strokeWidth="1.6" opacity="0.4" />
            {/* sparkle */}
            <path d="M120 74 h8 M124 70 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'envelope' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 90px' }}>
            {/* envelope body */}
            <path
              d="M44 62 Q44 58 48 58 L112 58 Q116 58 116 62 L116 112 Q116 116 112 116 L48 116 Q44 116 44 112 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* flap */}
            <path d="M46 60 L80 88 L114 60" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* seal */}
            <circle cx="80" cy="88" r="6" fill="var(--accent)" stroke={INK} strokeWidth="1.6" />
            {/* invite plus */}
            <circle cx="108" cy="48" r="11" fill="var(--card-mint-soft)" stroke={INK} strokeWidth="1.8" />
            <path d="M108 42 V54 M102 48 H114" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            {/* sparkles */}
            <path d="M36 96 h8 M40 92 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'bubble' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 88px' }}>
            {/* speech bubble */}
            <path
              d="M44 52 Q44 48 48 48 L112 48 Q116 48 116 52 L116 100 Q116 104 112 104 L72 104 L58 118 L60 104 L48 104 Q44 104 44 100 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* typing dots */}
            <circle cx="66" cy="76" r="3.4" fill={INK} opacity="0.55" />
            <circle cx="80" cy="76" r="3.4" fill={INK} opacity="0.55" />
            <circle cx="94" cy="76" r="3.4" fill="var(--accent)" stroke={INK} strokeWidth="1.2" />
            {/* reply bubble */}
            <path
              d="M96 108 Q96 106 98 106 L120 106 Q122 106 122 108 L122 126 Q122 128 120 128 L104 128 L98 134 L99 128 L98 128 Q96 128 96 126 Z"
              fill="var(--card-mint-soft)"
              stroke={INK}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {/* sparkle */}
            <path d="M34 66 h8 M38 62 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'key' && (
          <g style={{ transform: 'rotate(-12deg)', transformOrigin: '80px 88px' }}>
            {/* bow */}
            <circle cx="58" cy="72" r="17" fill={PAPER} stroke={INK} strokeWidth="2" />
            <circle cx="58" cy="72" r="7" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.8" />
            {/* shaft */}
            <path d="M70 84 L108 122" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
            {/* teeth */}
            <path d="M94 108 L102 100 M102 116 L112 106" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            {/* tag */}
            <g style={{ transform: 'rotate(12deg)', transformOrigin: '106px 60px' }}>
              <path d="M96 50 L122 50 L128 56 L122 62 L96 62 Q92 62 92 58 L92 54 Q92 50 96 50 Z" fill="var(--accent)" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="99" cy="56" r="1.8" fill={PAPER} />
            </g>
            {/* sparkles */}
            <path d="M40 108 h8 M44 104 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
            <path d="M118 84 h7 M121.5 80.5 v7" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'chart' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 90px' }}>
            {/* donut */}
            <circle cx="62" cy="92" r="22" fill="none" stroke={INK} strokeWidth="2" />
            <path d="M62 70 A22 22 0 0 1 84 92" fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" />
            <path d="M84 92 A22 22 0 0 1 62 114" fill="none" stroke={INK} strokeWidth="7" opacity="0.25" strokeLinecap="round" />
            {/* bars */}
            <rect x="96" y="100" width="10" height="14" rx="2" fill="var(--status-info)" stroke={INK} strokeWidth="1.4" />
            <rect x="110" y="90" width="10" height="24" rx="2" fill="var(--accent)" stroke={INK} strokeWidth="1.4" />
            <rect x="124" y="80" width="10" height="34" rx="2" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.4" />
            {/* baseline */}
            <path d="M40 118 H136" stroke={INK} strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
            {/* sparkle */}
            <path d="M36 60 h8 M40 56 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'canvas' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 88px' }}>
            {/* board */}
            <path
              d="M40 48 Q40 44 44 44 L116 44 Q120 44 120 48 L120 116 Q120 120 116 120 L44 120 Q40 120 40 116 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* marker squiggle */}
            <path d="M54 70 Q66 62 74 70 Q82 78 94 70 Q102 64 108 70" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" />
            <path d="M54 86 H92" stroke={INK} strokeWidth="1.6" opacity="0.3" strokeLinecap="round" />
            <path d="M54 96 H82" stroke={INK} strokeWidth="1.6" opacity="0.3" strokeLinecap="round" />
            {/* sticky note */}
            <g style={{ transform: 'rotate(6deg)', transformOrigin: '104px 100px' }}>
              <rect x="94" y="90" width="20" height="20" fill="var(--card-cream-soft)" stroke={INK} strokeWidth="1.6" />
            </g>
            {/* marker pen */}
            <path d="M118 118 L134 102" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
            <circle cx="136" cy="100" r="3" fill="var(--accent)" stroke={INK} strokeWidth="1.2" />
            {/* sparkle */}
            <path d="M32 60 h7 M35.5 56.5 v7" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'camera' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 88px' }}>
            {/* body */}
            <path
              d="M42 66 Q42 62 46 62 L60 62 L66 54 Q67 52 70 52 L90 52 Q93 52 94 54 L100 62 L114 62 Q118 62 118 66 L118 112 Q118 116 114 116 L46 116 Q42 116 42 112 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* lens */}
            <circle cx="80" cy="90" r="15" fill="var(--card-blue-soft)" stroke={INK} strokeWidth="2" />
            <circle cx="80" cy="90" r="6.5" fill={PAPER} stroke={INK} strokeWidth="1.6" />
            <circle cx="75" cy="85" r="2" fill={INK} opacity="0.4" />
            {/* flash dot */}
            <circle cx="106" cy="74" r="2.4" fill="var(--accent)" stroke={INK} strokeWidth="1.2" />
            {/* snapshot print */}
            <g style={{ transform: 'rotate(-6deg)', transformOrigin: '48px 122px' }}>
              <rect x="36" y="112" width="24" height="26" fill={PAPER} stroke={INK} strokeWidth="1.6" />
              <rect x="40" y="116" width="16" height="12" fill="var(--card-mint-soft)" stroke={INK} strokeWidth="1.2" />
            </g>
            {/* sparkle */}
            <path d="M124 52 h8 M128 48 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'table' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 90px' }}>
            {/* grid */}
            <path
              d="M42 56 Q42 52 46 52 L114 52 Q118 52 118 56 L118 120 Q118 124 114 124 L46 124 Q42 124 42 120 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* header row */}
            <path d="M42 70 H118" stroke={INK} strokeWidth="2" />
            <path d="M80 52 V124" stroke={INK} strokeWidth="1.4" opacity="0.5" />
            <path d="M42 88 H118 M42 106 H118" stroke={INK} strokeWidth="1.4" opacity="0.35" />
            {/* header dots */}
            <circle cx="56" cy="61" r="2.2" fill="var(--accent)" stroke={INK} strokeWidth="1" />
            <circle cx="96" cy="61" r="2.2" fill="var(--status-info)" stroke={INK} strokeWidth="1" />
            {/* relation link */}
            <path d="M118 97 Q130 97 130 85 Q130 73 122 71" stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none" strokeDasharray="4 3" />
            <circle cx="120" cy="70" r="2.6" fill={INK} />
            {/* sparkle */}
            <path d="M32 96 h8 M36 92 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'clock' && (
          <g>
            {/* face */}
            <circle cx="80" cy="88" r="30" fill={PAPER} stroke={INK} strokeWidth="2" />
            {/* ticks */}
            <path d="M80 62 V68 M80 108 V114 M54 88 H60 M100 88 H106" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
            {/* hands */}
            <path d="M80 88 V70" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M80 88 L94 94" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="80" cy="88" r="2.6" fill="var(--accent)" stroke={INK} strokeWidth="1.2" />
            {/* rewind arrow */}
            <path d="M48 116 A36 36 0 0 1 44 96" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeDasharray="4 3" />
            <path d="M38 98 L44 88 L50 97 Z" fill={INK} />
            {/* sparkle */}
            <path d="M116 60 h8 M120 56 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'box' && (
          <g style={{ transform: 'rotate(2deg)', transformOrigin: '80px 92px' }}>
            {/* body */}
            <path
              d="M48 70 L112 70 L106 124 Q106 127 103 127 L57 127 Q54 127 54 124 Z"
              fill="var(--card-cream-soft)"
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* lid */}
            <path
              d="M42 56 Q42 52 46 52 L114 52 Q118 52 118 56 L118 66 Q118 70 114 70 L46 70 Q42 70 42 66 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* label */}
            <rect x="66" y="90" width="28" height="18" rx="2" fill={PAPER} stroke={INK} strokeWidth="1.6" />
            <path d="M71 99 H89" stroke={INK} strokeWidth="1.6" opacity="0.35" strokeLinecap="round" />
            {/* dust sparkles */}
            <path d="M36 88 h7 M39.5 84.5 v7" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
            <path d="M120 100 h8 M124 96 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}

        {variant === 'memory' && (
          <g style={{ transform: 'rotate(-2deg)', transformOrigin: '80px 88px' }}>
            {/* back card */}
            <g style={{ transform: 'rotate(7deg)', transformOrigin: '90px 82px' }}>
              <rect x="58" y="46" width="64" height="72" rx="6" fill="var(--card-blue-soft)" stroke={INK} strokeWidth="2" />
            </g>
            {/* front card */}
            <path
              d="M42 58 Q42 54 46 54 L94 54 Q98 54 98 58 L98 118 Q98 122 94 122 L46 122 Q42 122 42 118 Z"
              fill={PAPER}
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* card lines */}
            <path d="M50 66 H90 M50 74 H82" stroke={INK} strokeWidth="1.6" opacity="0.3" strokeLinecap="round" />
            {/* linked nodes */}
            <circle cx="60" cy="96" r="7.5" fill={PAPER} stroke={INK} strokeWidth="1.8" />
            <circle cx="86" cy="96" r="7.5" fill={PAPER} stroke={INK} strokeWidth="1.8" />
            <path d="M67.5 96 H78.5" stroke={INK} strokeWidth="1.6" strokeDasharray="3 2" />
            <circle cx="86" cy="96" r="2.6" fill="var(--accent)" />
            {/* mini done card */}
            <g style={{ transform: 'rotate(5deg)', transformOrigin: '104px 114px' }}>
              <rect x="90" y="104" width="28" height="22" rx="4" fill="var(--card-mint-soft)" stroke={INK} strokeWidth="1.8" />
              <path d="M97 113 l4 4 7 -8" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
            {/* floating done pill */}
            <g style={{ transform: 'rotate(-6deg)', transformOrigin: '128px 42px' }}>
              <rect x="106" y="32" width="44" height="20" rx="10" fill="var(--accent)" stroke={INK} strokeWidth="1.6" />
              <path d="M117 42 l4.5 4.5 L130 37" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>
            {/* star sparkle */}
            <path
              d="M28 102 L30.5 109 L37 112 L30.5 115 L28 122 L25.5 115 L19 112 L25.5 109 Z"
              fill="var(--card-cream-soft)"
              stroke={INK}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            {/* presence cursor */}
            <g style={{ transform: 'rotate(8deg)', transformOrigin: '40px 40px' }}>
              <path d="M32 30 L32 52 L38 46 L42 54 L46 52 L42 44 L48 44 Z" fill={PAPER} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
            </g>
            {/* drifting node */}
            <circle cx="132" cy="96" r="6" fill={PAPER} stroke={INK} strokeWidth="1.6" />
            <path d="M126 90 Q120 84 114 84" stroke={INK} strokeWidth="1.4" strokeDasharray="3 2" fill="none" />
            <circle cx="132" cy="96" r="2" fill="var(--status-info)" />
            {/* cross sparkle */}
            <path d="M52 34 h9 M56.5 29.5 v9" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
            {/* sparkles */}
            <path d="M34 76 h8 M38 72 v8" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
            <path d="M122 60 h7 M125.5 56.5 v7" stroke={INK} strokeWidth="1.6" opacity="0.4" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </div>
  );
}
