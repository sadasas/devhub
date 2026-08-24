import { useTranslation } from 'react-i18next';

interface UsageMeterProps {
  label: string;
  used: number;
  limit: number | null;
}

export function UsageMeter({ label, used, limit }: UsageMeterProps) {
  const { t } = useTranslation();
  if (limit === null) {
    return (
      <div className="usage-meter">
        <span className="usage-meter-label">{label}</span>
        <span className="usage-meter-value">{t('usage.unlimited')}</span>
      </div>
    );
  }
  const pct = limit <= 0 ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const tone = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : 'ok';
  return (
    <div className="usage-meter">
      <span className="usage-meter-label">{label}</span>
      <div
        className="usage-meter-bar"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={t('usage.ofLimit', { label, used, limit })}
      >
        <div className={`usage-meter-fill usage-meter-${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="usage-meter-value">
        {used} / {limit}
      </span>
    </div>
  );
}
