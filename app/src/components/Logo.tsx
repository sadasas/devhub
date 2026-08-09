export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="var(--accent)" />
      <circle cx="16" cy="16" r="3" fill="var(--text-on-accent)" />
      <path
        d="M16 13V9.5M16 19V22.5M13 16H9.5M19 16H22.5"
        stroke="var(--text-on-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
