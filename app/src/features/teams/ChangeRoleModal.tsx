import { useEffect, useState } from 'react';
import { FloppyDisk } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { TEAM_ROLE } from '../../lib/labels';
import type { TeamMember, TeamRole } from '../../lib/types';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { InlineError } from '../../components/InlineError';

const CHANGEABLE_ROLES: TeamRole[] = ['admin', 'editor', 'viewer'];
const ALL_ROLES: TeamRole[] = [...CHANGEABLE_ROLES, 'owner'];

interface Props {
  open: boolean;
  member: TeamMember | null;
  teamRole: TeamRole | undefined;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (role: TeamRole) => void;
}

export function ChangeRoleModal({ open, member, teamRole, busy, error, onClose, onConfirm }: Props) {
  const { t } = useTranslation('account');
  const [selected, setSelected] = useState<TeamRole>('viewer');

  useEffect(() => {
    if (open && member) setSelected(member.role);
  }, [open, member]);

  if (!member) return null;
  const isOwnerTeam = teamRole === 'owner';
  const options: TeamRole[] = isOwnerTeam ? ALL_ROLES : CHANGEABLE_ROLES;
  const isDirty = selected !== member.role;
  const isTransfer = selected === 'owner';

  return (
    <Modal
      open={open}
      title={t('teams.changeRoleModal.title', { name: member.displayName?.trim() || member.email })}
      onClose={busy ? undefined : onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={!!busy}>
            {t('common:action.cancel')}
          </Button>
          <Button
            variant="primary"
            leftIcon={<FloppyDisk size={13} aria-hidden="true" />}
            loading={!!busy}
            disabled={!isDirty || !!busy}
            onClick={() => onConfirm(selected)}
          >
            {t('teams.changeRoleModal.save')}
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <p className="modal-copy">{t('teams.changeRoleModal.intro')}</p>

        <div role="radiogroup" aria-label={t('teams.changeRoleModal.title', { name: member.email })} className="role-options">
          {options.map((r) => (
            <label key={r} className={`role-option ${selected === r ? 'role-option-active' : ''}`}>
              <input
                type="radio"
                name="team-role"
                value={r}
                checked={selected === r}
                onChange={() => setSelected(r)}
                className="sr-only"
              />
              <span className="role-option-head">
                <span className="role-option-label">{TEAM_ROLE[r].label}</span>
                <Badge tone={TEAM_ROLE[r].tone}>{TEAM_ROLE[r].label}</Badge>
              </span>
              <span className="role-option-desc">{t(`teams.changeRoleModal.desc.${r}`)}</span>
            </label>
          ))}
        </div>

        {isTransfer && (
          <div className="callout callout-warn" role="alert">
            {t('teams.changeRoleModal.transferWarn')}
          </div>
        )}

        {error && <InlineError>{error}</InlineError>}
      </div>
    </Modal>
  );
}
