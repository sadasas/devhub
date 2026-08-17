const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function startLabel(startDate: string | null | undefined): string {
  if (!startDate) return '';
  return `Starts ${shortDate.format(new Date(`${startDate}T00:00:00Z`))}`;
}

export function startAfterDue(
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
): boolean {
  if (!startDate || !dueDate) return false;
  return Date.parse(`${startDate}T00:00:00Z`) > Date.parse(`${dueDate}T00:00:00Z`);
}