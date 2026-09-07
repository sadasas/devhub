import { useTranslation } from 'react-i18next';

interface TourProgressPillProps {
  current: number;
  total: number;
}

/** Progress pill X/7 — not a checklist. Always >=24px target-safe (visual only). */
export function TourProgressPill({ current, total }: TourProgressPillProps) {
  const { t } = useTranslation('project');
  return (
    <span
      className="tour-pill"
      role="status"
      aria-label={t('tour.common.progressAria', { current, total })}
    >
      <span aria-hidden="true" className="tour-pill-text">
        {current}/{total}
      </span>
      <span className="sr-only">{t('tour.common.stepOf', { current, total })}</span>
    </span>
  );
}
