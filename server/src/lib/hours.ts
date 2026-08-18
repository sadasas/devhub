export function startOfDayMs(dateStr: string): number {
  return Date.parse(`${dateStr}T00:00:00.000Z`);
}

export function deriveActualHours(params: {
  completedAt: string;
  createdAt: string;
  startDate?: string | null;
}): number {
  const base = params.startDate ? startOfDayMs(params.startDate) : Date.parse(params.createdAt);
  const hours = (Date.parse(params.completedAt) - base) / 3.6e6;
  return Math.max(0, Math.round(hours * 10) / 10);
}