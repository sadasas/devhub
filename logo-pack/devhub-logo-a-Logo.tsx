export function Logo({ size = 20, variant = "solid" }: { size?: number; variant?: "solid" | "mono" }) {
  // Konsep A — hub node hex. Drop-in: viewBox 32 dipertahankan.
  // Solid: bg var(--accent) agar otomatis sage gelap #5DB69B / terang #4A8B6F.
  // Tinta #0A1F18 (bukan putih): kontras 7.0:1 di sage gelap, 4.3:1 di sage terang.
  const solid = variant === "solid";
  const bg = solid ? "var(--accent)" : "var(--bg-elevated)";
  const ink = solid ? "#0A1F18" : "var(--text-primary)";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="8"
        fill={bg}
        stroke={solid ? "none" : "var(--border-strong)"}
      />
      <path
        d="M16 9.5L21.8 12.8V19.2L16 22.5L10.2 19.2V12.8Z"
        fill="none"
        stroke={ink}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M16 16V9.5M16 16L10.2 19.2M16 16L21.8 19.2"
        stroke={ink}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="2.6" fill={ink} />
    </svg>
  );
}
