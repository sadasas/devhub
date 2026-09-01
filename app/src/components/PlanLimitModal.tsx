import { useNavigate } from 'react-router';
import { ArrowRight, FolderOpen } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Modal } from './Modal';
import { InlineError } from './InlineError';

export type PlanLimitResource = 'projects' | 'members';

interface PlanLimitModalProps {
  open: boolean;
  resource: PlanLimitResource | null;
  teamId: string;
  onClose: () => void;
  details?: { limit: number; used: number } | null;
  mode?: 'default' | 'downgrade-blocked';
  targetPackageName?: string | null;
}

const COPY: Record<PlanLimitResource, string> = {
  projects: 'Project limit reached on your current plan.',
  members: 'Member limit reached on your current plan.',
};

export function PlanLimitModal({
  open,
  resource,
  teamId,
  onClose,
  details,
  mode,
  targetPackageName,
}: PlanLimitModalProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(['extras', 'account']);
  const isDowngradeBlocked = mode === 'downgrade-blocked' && details;

  function onGoPricing() {
    onClose();
    navigate(`/pricing?teamId=${teamId}`);
  }

  function onManageProjects() {
    onClose();
    navigate(`/team/${teamId}?tab=projects`);
  }

  if (isDowngradeBlocked && details) {
    const title = targetPackageName
      ? t('extras:pricing.downgradeBlockedTitle', { name: targetPackageName, defaultValue: `Tidak bisa downgrade ke ${targetPackageName}` })
      : t('extras:pricing.downgradeBlockedTitleGeneric', { defaultValue: 'Tidak bisa downgrade' });
    return (
      <Modal
        open={open && resource !== null}
        title={title}
        onClose={onClose}
        width="sm"
        footer={
          <>
            <Button variant="ghost" leftIcon={<FolderOpen size={13} aria-hidden="true" />} onClick={onManageProjects}>
              {t('extras:pricing.manageProjects', { defaultValue: 'Kelola proyek' })}
            </Button>
            <Button variant="primary" leftIcon={<ArrowRight size={13} aria-hidden="true" />} onClick={onGoPricing}>
              {t('extras:pricing.viewOtherPackages', { defaultValue: 'Lihat paket lain' })}
            </Button>
          </>
        }
      >
        <div className="form-stack">
          <p className="modal-copy">
            {t('extras:pricing.downgradeBlockedDesc', {
              name: targetPackageName ?? '',
              defaultValue: `Downgrade diblokir karena pemakaian melebihi batas paket tujuan.`,
            })}
          </p>
          <InlineError className="billing-warn">
            {t('extras:pricing.downgradeBlockedHint', {
              used: details.used,
              limit: details.limit,
              defaultValue: `Pakai ${details.used}/${details.limit}`,
            })}
          </InlineError>
          <p className="modal-copy">{t('extras:pricing.downgradeBlockedHelp', { defaultValue: 'Kurangi anggota atau proyek, atau pilih paket dengan limit lebih tinggi.' })}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open && resource !== null}
      title="Upgrade workspace"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
          <Button variant="primary" leftIcon={<ArrowRight size={13} aria-hidden="true" />} onClick={onGoPricing}>
            Lihat Pricing
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <p className="modal-copy">{resource ? COPY[resource] : ''}</p>
        {details && (
          <InlineError className="billing-warn">
            {t('extras:pricing.downgradeBlockedHint', {
              used: details.used,
              limit: details.limit,
              defaultValue: `Pakai ${details.used}/${details.limit}`,
            })}
          </InlineError>
        )}
        <p className="modal-copy">
          Lihat opsi paket &amp; durasi di halaman Pricing untuk melanjutkan upgrade.
        </p>
      </div>
    </Modal>
  );
}
