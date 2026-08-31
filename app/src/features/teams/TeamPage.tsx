import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChartLineUp, Envelope, Trash, UsersThree } from '@phosphor-icons/react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { TEAM_ROLE } from '../../lib/labels';
import type { TeamInvitation, TeamMember, TeamRole } from '../../lib/types';
import { useTeams } from '../../state/teams-context';
import { useAuth } from '../../state/auth-context';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Skeleton } from '../../components/Skeleton';
import { InviteModal } from './InviteModal';
import { TeamBillingPanel } from './TeamBillingPanel';
import { InlineError } from '../../components/InlineError';
import { FE_LIMITS } from '../../lib/limits';

const CHANGEABLE_ROLES: TeamRole[] = ['admin', 'editor', 'viewer'];
const ALL_ROLES: TeamRole[] = [...CHANGEABLE_ROLES, 'owner'];

export function TeamPage() {
  const { t } = useTranslation('account');
  const { teamId = '' } = useParams<{ teamId: string }>();
  const { teams, refresh, deleteTeam, renameTeam } = useTeams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'usage' ? 'usage' : 'members';
  const team = teams?.find((t) => t.id === teamId);

  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [pendingInvites, setPendingInvites] = useState<TeamInvitation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const isAdmin = team?.role === 'owner' || team?.role === 'admin';

  const loadMembers = useCallback(async () => {
    try {
      const list = await api.listMembers(teamId);
      setMembers(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, t('teams.errors.loadMembers')));
    }
  }, [teamId, t]);

  const loadPendingInvites = useCallback(async () => {
    try {
      const list = await api.listTeamInvitations(teamId);
      setPendingInvites(list);
    } catch {
      setPendingInvites(null);
    }
  }, [teamId]);

  useEffect(() => {
    setMembers(null);
    setPendingInvites(null);
    setActionError(null);
    void loadMembers();
    void loadPendingInvites();
  }, [loadMembers, loadPendingInvites]);

  useEffect(() => {
    if (renameOpen) setRenameValue(team?.name ?? '');
  }, [renameOpen, team?.name]);

  async function onChangeRole(member: TeamMember, role: TeamRole) {
    if (role === member.role) return;
    setBusyId(member.id);
    setActionError(null);
    try {
      await api.setMemberRole(teamId, member.id, role);
      setMembers((prev) => (prev ? prev.map((m) => (m.id === member.id ? { ...m, role } : m)) : prev));
      if (role === 'owner') await refresh();
    } catch (err) {
      setActionError(getErrorMessage(err, t('teams.errors.changeRole')));
    } finally {
      setBusyId(null);
    }
  }

  async function onWithdrawInvite(inv: TeamInvitation) {
    setBusyId(inv.id);
    setActionError(null);
    try {
      await api.declineInvitation(teamId, inv.id);
      setPendingInvites((prev) => (prev ? prev.filter((i) => i.id !== inv.id) : prev));
    } catch (err) {
      setActionError(getErrorMessage(err, t('teams.errors.withdrawInvite')));
    } finally {
      setBusyId(null);
    }
  }

  async function onRemoveMember(member: TeamMember) {
    setBusyId(member.id);
    setActionError(null);
    try {
      await api.removeMember(teamId, member.id);
      setMembers((prev) => (prev ? prev.filter((m) => m.id !== member.id) : prev));
      await refresh();
    } catch (err) {
      setActionError(getErrorMessage(err, t('teams.errors.removeMember')));
    } finally {
      setBusyId(null);
    }
  }

  async function onLeave() {
    if (!team || !user) return;
    setDeleting(true);
    setActionError(null);
    try {
      await api.removeMember(teamId, user.id);
      await refresh();
      navigate('/');
    } catch (err) {
      setActionError(getErrorMessage(err, t('teams.errors.leave')));
      setDeleting(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    setActionError(null);
    try {
      await deleteTeam(teamId);
      navigate('/');
    } catch (err) {
      setActionError(getErrorMessage(err, t('teams.errors.deleteTeam')));
      setDeleting(false);
    }
  }

  async function onRename(e: React.FormEvent) {
    e.preventDefault();
    setRenaming(true);
    setActionError(null);
    try {
      await renameTeam(teamId, renameValue.trim());
      setRenameOpen(false);
    } catch (err) {
      setActionError(getErrorMessage(err, t('teams.errors.rename')));
    } finally {
      setRenaming(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <button type="button" className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={14} aria-hidden="true" />
            {t('teams.backToDashboard')}
          </button>
          {team ? (
            <div className="project-title-row">
              <h1 className="page-title">{team.name}</h1>
              <Badge tone={TEAM_ROLE[team.role].tone}>{TEAM_ROLE[team.role].label}</Badge>
              <Badge tone={team.plan === 'pro' ? 'info' : 'neutral'}>
                {team.planPackageName}
              </Badge>
              <Badge tone="neutral">{t('teams.memberCount', { count: team.memberCount })}</Badge>
            </div>
          ) : (
            <Skeleton style={{ width: 200, height: 24, marginTop: 8 }} />
          )}
          <p className="page-subtitle">{t('teams.subtitle')}</p>
        </div>
        <div className="project-title-row gap-8">
          {team && isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Envelope size={13} aria-hidden="true" />}
              onClick={() => setInviteOpen(true)}
            >
              {t('teams.invite')}
            </Button>
          )}
          {team && isAdmin && (
            <Button variant="ghost" size="sm" onClick={() => setRenameOpen(true)}>
              {t('teams.rename')}
            </Button>
          )}
          {team && team.role === 'owner' && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash size={13} aria-hidden="true" />}
              onClick={() => setDeleteOpen(true)}
            >
              {t('teams.deleteTeam')}
            </Button>
          )}
        </div>
      </header>

      {loadError && <InlineError>{loadError}</InlineError>}
      {actionError && <InlineError>{actionError}</InlineError>}

      <div className="sub-tabs" role="tablist" aria-label={t('teams.tabsAria')}>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'members' ? 'sub-tab-active' : ''}`}
          onClick={() => setSearchParams({}, { replace: true })}
          aria-selected={tab === 'members'}
        >
          <UsersThree size={13} aria-hidden="true" />
          {t('teams.tabMembers')}
        </button>
        <button
          type="button"
          role="tab"
          className={`sub-tab ${tab === 'usage' ? 'sub-tab-active' : ''}`}
          onClick={() => setSearchParams({ tab: 'usage' }, { replace: true })}
          aria-selected={tab === 'usage'}
        >
          <ChartLineUp size={13} aria-hidden="true" />
          {t('teams.tabUsage')}
        </button>
      </div>

      {tab === 'usage' && <TeamBillingPanel teamId={teamId} isAdmin={isAdmin} />}

      {tab === 'members' && (
        <>
      <section className="tab-panel" role="tabpanel" aria-labelledby="team-tab-members">
            {members === null ? (
          <>
            <Skeleton style={{ width: '100%', height: 48 }} />
            <Skeleton style={{ width: '100%', height: 48, marginTop: 8 }} />
          </>
        ) : members.length === 0 ? (
          <div className="page-empty">
            <EmptyState
              icon={<UsersThree size={22} />}
              title={t('teams.emptyTitle')}
              description={t('teams.emptyDescription')}
            />
          </div>
        ) : (
          members.map((m) => {
            const isOwner = m.role === 'owner';
            const roleOptions = isOwner || !isAdmin ? [] : team?.role === 'owner' ? ALL_ROLES : CHANGEABLE_ROLES;
            return (
              <div key={m.id} className="data-row">
                <div className="data-row-main">
                  <span className="data-row-title">
                    <span className="row-title-text">{m.email}</span>
                    <Badge tone={TEAM_ROLE[m.role].tone}>{TEAM_ROLE[m.role].label}</Badge>
                  </span>
                  <span className="data-row-meta">{t('teams.joinedOn', { date: new Date(m.joinedAt).toLocaleDateString() })}</span>
                </div>
                <div className="data-row-side">
                  {roleOptions.length > 0 && (
                    <select
                      className="select select-role"
                      value={m.role}
                      disabled={busyId === m.id}
                      title={
                        roleOptions.includes('owner')
                          ? t('teams.transferOwnership')
                          : undefined
                      }
                      onChange={(e) => void onChangeRole(m, e.target.value as TeamRole)}
                    >
                      {roleOptions.map((r) => (
                        <option key={r} value={r}>
                          {TEAM_ROLE[r].label}
                        </option>
                      ))}
                    </select>
                  )}
                  {!isOwner && isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      loading={busyId === m.id}
                      onClick={() => void onRemoveMember(m)}
                    >
                      {t('teams.remove')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </section>

      {tab === 'members' && isAdmin && pendingInvites !== null && pendingInvites.length > 0 && (
        <section className="tab-panel mt-24">
          <h2 className="panel-title text-muted">{t('teams.pendingInvitations')}</h2>
          {pendingInvites.map((inv) => (
            <div key={inv.id} className="data-row">
              <div className="data-row-main">
                <span className="data-row-title">
                  <span className="row-title-text">{inv.email}</span>
                  <Badge tone={TEAM_ROLE[inv.role].tone}>{TEAM_ROLE[inv.role].label}</Badge>
                </span>
                <span className="data-row-meta">
                  {t('teams.expiresOn', { date: new Date(inv.expiresAt).toLocaleDateString() })}
                </span>
              </div>
              <div className="data-row-side">
                <Button
                  variant="ghost"
                  size="sm"
                  loading={busyId === inv.id}
                  onClick={() => void onWithdrawInvite(inv)}
                >
                  {t('teams.withdraw')}
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {team && team.role !== 'owner' && tab === 'members' && (
        <div className="page-footer">
          <Button variant="ghost" size="sm" className="text-danger" onClick={() => setLeaveOpen(true)}>
            {t('teams.leaveTeam')}
          </Button>
        </div>
      )}
      </>
      )}

      <InviteModal
        teamId={teamId}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          void refresh();
          void loadPendingInvites();
        }}
      />

      <Modal
        open={renameOpen}
        title={t('teams.renameModal.title')}
        onClose={() => setRenameOpen(false)}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button
              type="submit"
              form="rename-team-form"
              loading={renaming}
              disabled={!renameValue.trim()}
            >
              {t('teams.renameModal.save')}
            </Button>
          </>
        }
      >
        <form id="rename-team-form" className="form-stack" onSubmit={onRename} noValidate>
          <Input
            label={t('teams.renameModal.name')}
            required
            autoFocus
            value={renameValue}
            maxLength={FE_LIMITS.TEAM_NAME}
            showCount
            onChange={(e) => setRenameValue(e.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={deleteOpen}
        title={t('teams.deleteModal.title')}
        onClose={() => setDeleteOpen(false)}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void onDelete()}>
              {t('common:action.delete')}
            </Button>
          </>
        }
      >
        <p className="modal-copy">
          {t('teams.deleteModal.body', { name: team?.name })}
        </p>
      </Modal>

      <Modal
        open={leaveOpen}
        title={t('teams.leaveModal.title')}
        onClose={() => setLeaveOpen(false)}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
              {t('common:action.cancel')}
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void onLeave()}>
              {t('teams.leaveModal.confirm')}
            </Button>
          </>
        }
      >
        <p className="modal-copy">
          {t('teams.leaveModal.body', { name: team?.name })}
        </p>
      </Modal>
    </div>
  );
}
