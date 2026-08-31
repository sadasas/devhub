import { i18n, getAppLocale } from '../i18n';

const shortDateCache = new Map<string, Intl.DateTimeFormat>();

function shortDate(): Intl.DateTimeFormat {
  const locale = getAppLocale();
  let fmt = shortDateCache.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
    shortDateCache.set(locale, fmt);
  }
  return fmt;
}

export function startLabel(startDate: string | null | undefined): string {
  if (!startDate) return '';
  return i18n.t('common:time.startsPrefix', {
    date: shortDate().format(new Date(`${startDate}T00:00:00Z`)),
  });
}

export function startAfterDue(
  startDate: string | null | undefined,
  dueDate: string | null | undefined,
): boolean {
  if (!startDate || !dueDate) return false;
  return Date.parse(`${startDate}T00:00:00Z`) > Date.parse(`${dueDate}T00:00:00Z`);
}