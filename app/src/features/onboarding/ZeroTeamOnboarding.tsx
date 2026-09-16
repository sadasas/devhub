import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Plus } from '@phosphor-icons/react';
import { useTeams } from '../../state/teams-context';
import { useAuth } from '../../state/auth-context';
import { Button } from '../../components/Button';
import { Avatar } from '../../components/Avatar';
import { DoodleIllustration } from '../../components/DoodleIllustration';
import { LegalFooter } from '../../components/LegalFooter';
import { CreateTeamModal } from '../teams/CreateTeamModal';
import { OnboardingWizard } from './OnboardingWizard';
import { useOnboardingTour } from './useOnboardingTour';
import { hasTourStep, readTourStep } from './tour-events';
import { fastForwardStep } from './tour-dom';
import { writeLastActiveTeamId } from '../layout/WorkspaceSwitcher';
import type { Team } from '../../lib/types';

// Canonical zero-team onboarding — replaces HomeRedirect zero-branch +
// DashboardZeroTeams. Single centered column (max 560px via
// .dashboard__onboarding), no eyebrow, no invites button (invite-only users
// are redirected to /invites by HomeRedirect).
export function ZeroTeamOnboarding() {
  const { t } = useTranslation('account');
  const { t: tShell } = useTranslation('shell');
  const { teams, invitations } = useTeams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const tour = useOnboardingTour();

  // Tour auto-start (zero-team only): fresh users start at 0, resume honors
  // the persisted step but never jumps past 1 (step 2+ belongs to the
  // workspace / project pages).
  useEffect(() => {
    if (tour.active || tour.skipped || tour.finished) return;
    if (teams === null) return;
    if (teams.length > 0) return;
    if (hasTourStep()) {
      const at = fastForwardStep(readTourStep(), false);
      if (at > 1) return;
      tour.start(at);
      return;
    }
    tour.start(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, tour.active, tour.skipped, tour.finished]);

  const handleSuccess = (team: Team) => {
    setCreateOpen(false);
    writeLastActiveTeamId(team.id);
    if (tour.active && tour.step <= 1) tour.goTo(2);
    navigate(`/${encodeURIComponent(team.slug || team.id)}/projects`, { replace: true });
  };

  const displayName = user
    ? user.displayName?.trim() || user.email.split('@')[0] || user.email
    : '';

  return (
    <div className="dashboard__onboarding dashboard__onboarding--center">
      <div className="zero-team-doodle" aria-hidden="true">
        <DoodleIllustration variant="thinking" tone="neutral" size={140} />
      </div>
      <h1 className="page-title dashboard__onboarding-title">
        {t('dashboard.team.onboardingTitle')}
      </h1>
      <p className="page-subtitle dashboard__onboarding-desc">
        {t('dashboard.team.onboardingDesc')}
      </p>
      <div className="dashboard__onboarding-actions dashboard__onboarding-actions--center">
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus size={14} weight="bold" aria-hidden="true" />}
          onClick={() => setCreateOpen(true)}
          data-tour-id="create-team"
        >
          {t('dashboard.welcome.empty.createTeam')}
        </Button>
        {invitations.length > 0 && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => navigate('/invites')}
            data-tour-id="view-invites"
          >
            {t('dashboard.team.viewInvitesCount', { count: invitations.length })}
          </Button>
        )}
      </div>

      <p className="zero-team-steps-title" aria-hidden="true">
        {t('dashboard.team.stepsTitle')}
      </p>
      <ol className="zero-team-steps" aria-label={t('dashboard.team.stepsTitle')}>
        <li className="zero-team-step">
          <span className="zero-team-step-num" aria-hidden="true">
            1
          </span>
          <span>{t('dashboard.team.stepOne')}</span>
        </li>
        <li className="zero-team-step">
          <span className="zero-team-step-num" aria-hidden="true">
            2
          </span>
          <span>{t('dashboard.team.stepTwo')}</span>
        </li>
        <li className="zero-team-step">
          <span className="zero-team-step-num" aria-hidden="true">
            3
          </span>
          <span>{t('dashboard.team.stepThree')}</span>
        </li>
      </ol>

      {user && (
        <footer className="zero-team-footer">
          <span className="zero-team-user">
            <Avatar
              src={user.avatarUrl ?? null}
              name={displayName}
              email={user.email}
              id={user.id}
              size={24}
            />
            <span className="zero-team-name">{displayName}</span>
          </span>
          <span className="zero-team-sep" aria-hidden="true">
            ·
          </span>
          <Link className="sidebar-team-link zero-team-foot-link" to="/docs">
            {tShell('sidebar.docs')}
          </Link>
          <span className="zero-team-sep" aria-hidden="true">
            ·
          </span>
          <button
            type="button"
            className="sidebar-team-link zero-team-foot-link zero-team-logout"
            onClick={() => void logout()}
          >
            {tShell('sidebar.signOut')}
          </button>
        </footer>
      )}
      <LegalFooter compact />

      <CreateTeamModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleSuccess}
      />

      {tour.active && tour.step <= 1 && (
        <OnboardingWizard
          step={tour.step}
          total={tour.total}
          onNext={tour.next}
          onBack={tour.back}
          onSkip={tour.skip}
          onFinish={tour.finish}
          blockReason={tour.step === 1 && teams !== null && teams.length === 0 ? 'team' : null}
        />
      )}
    </div>
  );
}
