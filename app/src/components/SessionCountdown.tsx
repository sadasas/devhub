import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClockCountdown } from '@phosphor-icons/react';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/**
 * Countdown sesi — hitung mundur live per detik (BI, actionable).
 * Dipakai di halaman Kunci/Token (KeysPage) untuk setiap token OAuth yang kedaluwarsa 15 mnt.
 */
export function SessionCountdown({
  expiresAt,
  compact = false,
}: {
  expiresAt: string;
  compact?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const target = Date.parse(expiresAt);
  if (Number.isNaN(target)) return null;
  const diff = target - now;
  const expired = diff <= 0;
  const label = expired
    ? (t('session.expired', { defaultValue: lang === 'id' ? 'Sesi kedaluwarsa — token diperbarui otomatis.' : 'Session expired — token auto-refreshes.' }) as string)
    : (t('session.remaining', {
        defaultValue: lang === 'id' ? 'Sesi berakhir dalam {{time}}' : 'Session ends in {{time}}',
        time: formatCountdown(diff),
      }) as string);

  return (
    <span
      className={`session-countdown${expired ? ' session-countdown--expired' : ''}${compact ? ' session-countdown--compact' : ''}`}
      role="timer"
      aria-live="off"
      title={new Date(expiresAt).toLocaleString()}
    >
      <ClockCountdown size={12} weight="duotone" aria-hidden="true" />
      <span className="tabular">{label}</span>
    </span>
  );
}
