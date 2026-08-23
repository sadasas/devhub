import { useNavigate } from 'react-router';
import { Button } from './Button';
import { Modal } from './Modal';

export type PlanLimitResource = 'projects' | 'members';

interface PlanLimitModalProps {
  open: boolean;
  resource: PlanLimitResource | null;
  teamId: string;
  onClose: () => void;
}

const COPY: Record<PlanLimitResource, string> = {
  projects: 'Project limit reached on your current plan.',
  members: 'Member limit reached on your current plan.',
};

export function PlanLimitModal({ open, resource, teamId, onClose }: PlanLimitModalProps) {
  const navigate = useNavigate();

  function onGoPricing() {
    onClose();
    navigate(`/pricing?teamId=${teamId}`);
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
          <Button variant="primary" onClick={onGoPricing}>
            Lihat Pricing
          </Button>
        </>
      }
    >
      <div className="form-stack">
        <p className="modal-copy">{resource ? COPY[resource] : ''}</p>
        <p className="modal-copy">
          Lihat opsi paket &amp; durasi di halaman Pricing untuk melanjutkan upgrade.
        </p>
      </div>
    </Modal>
  );
}
