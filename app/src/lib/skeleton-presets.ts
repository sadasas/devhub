// Shared height/width constants so skeleton drift is detectable via single source.
// Kept as pure constants (no React) so it can be imported without pulling chunks.
export const SKELETON_SIZES = {
  dataRow: { height: 56, count: 3 },
  dataRowCompact: { height: 48, count: 2 },
  taskCard: { height: 88, minHeight: 84, maxHeight: 110 },
  welcomeRow: { height: 52 },
  pricingCard: { height: 160 },
  avatar: { sm: 20, md: 28, lg: 56, team: 40 },
  badge: { w: 56, h: 18, smallW: 48, smallH: 18 },
  tab: { w: 84, h: 36 },
  btn: { w: 96, h: 32 },
  heatCell: { size: 10, gap: 3 },
} as const;
