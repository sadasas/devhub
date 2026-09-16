import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EnvelopeSimple, MagnifyingGlass, Trash, UsersThree, X } from '@phosphor-icons/react';
import { api } from '../../lib/api';
import { getErrorMessage } from '../../lib/errors';
import { TEAM_ROLE } from '../../lib/labels';
import type { Team, TeamInvitation, TeamMember, TeamRole } from '../../lib/types';
import { useTeams } from '../../state/teams-context';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { DataErrorState } from '../../components/DataErrorState';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog';
import { InviteModal } from '../teams/InviteModal';
import { ChangeRoleModal } from '../teams/ChangeRoleModal';

const CHANGEABLE_ROLES: TeamRole[] = ['admin', 'editor', 'viewer'];
const ALL_ROLES: TeamRole[] = [...CHANGEABLE_ROLES, 'owner'];

// Local search is only worth the chrome once the roster grows.
const MEMBER_SEARCH_THRESHOLD = 5;

interface DashboardMembersTabProps {
  team: Team;
}

// Members tab scoped to the already-resolved active team.
// Mirrors TeamPage members pattern (toolbar + 56px data-row + pending
// invites + Invite/Role/Remove dialogs) without touching routes or API.
export function DashboardMembersTab({ team }: DashboardMembersTabProps) {
  const { t } = useTranslation('account');
  const { refresh } = useTeams();

  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [pendingInvites, setPendingInvites] = useState<TeamInvitation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorRaw, setLoadErrorRaw] = useState<unknown>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<TeamInvitation | null>(null);
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Local-only filter state — never written to the URL (?team=&tab= only).
  const [query, setQuery] = useState('');

  const isAdmin = team.role === 'owner' || team.role === 'admin';

  const loadMembers = useCallback(async () => {
    try {
      const list = await api.listMembers(team.id);
      setMembers(list);
      setLoadError(null);
      setLoadErrorRaw(null);
    } catch (err) {
      setLoadError(getErrorMessage(err, t('teams.errors.loadMembers')));
      setLoadErrorRaw(err);
    }
  }, [team.id, t]);

  const loadPendingInvites = useCallback(async () => {
    try {
      const list = await api.listTeamInvitations(team.id);
      setPendingInvites(list);
    } catch {
      // Pending invites stay hidden when the scoped fetch fails.
      setPendingInvites(null);
    }
  }, [team.id]);

  const reloadMembersTab = useCallback(() => {
    void loadMembers();
    void loadPendingInvites();
  }, [loadMembers, loadPendingInvites]);

  // This tab only mounts when it is the active tab, so mounting
  // equals "fetch the active tab only". Reset on team switch.
  useEffect(() => {
    setMembers(null);
    setPendingInvites(null);
    setLoadError(null);
    setLoadErrorRaw(null);
    setRemoveError(null);
    setWithdrawError(null);
    setRoleError(null);
    setQuery('');
    setInviteOpen(false);
    setRemoveTarget(null);
    setWithdrawTarget(null);
    setRoleTarget(null);
    void loadMembers();
    void loadPendingInvites();
  }, [loadMembers, loadPendingInvites]);

  async function onConfirmRole(role: TeamRole) {
    if (!roleTarget || role === roleTarget.role) return;
    setRoleBusy(true);
    setRoleError(null);
    setBusyId(roleTarget.id);
    try {
      await api.setMemberRole(team.id, roleTarget.id, role);
      setMembers((prev) => (prev ? prev.map((m) => (m.id === roleTarget.id ? { ...m, role } : m)) : prev));
      // Ownership transfer changes the header badge + gating.
      if (role === 'owner') await refresh();
      setRoleTarget(null);
    } catch (err) {
      setRoleError(getErrorMessage(err, t('teams.errors.changeRole')));
    } finally {
      setRoleBusy(false);
      setBusyId(null);
    }
  }

  async function onWithdrawInvite(inv: TeamInvitation) {
    setBusyId(inv.id);
    setWithdrawError(null);
    try {
      await api.declineInvitation(team.id, inv.id);
      setPendingInvites((prev) => (prev ? prev.filter((i) => i.id !== inv.id) : prev));
      setWithdrawTarget(null);
    } catch (err) {
      setWithdrawError(getErrorMessage(err, t('teams.errors.withdrawInvite')));
    } finally {
      setBusyId(null);
    }
  }

  async function onRemoveMember(member: TeamMember) {
    setBusyId(member.id);
    setRemoveError(null);
    try {
      await api.removeMember(team.id, member.id);
      setMembers((prev) => (prev ? prev.filter((m) => m.id !== member.id) : prev));
      await refresh();
      setRemoveTarget(null);
    } catch (err) {
      setRemoveError(getErrorMessage(err, t('teams.errors.removeMember')));
    } finally {
      setBusyId(null);
    }
  }

  // Search only appears for larger rosters; filtering stays local.
  const showSearch = (members?.length ?? 0) > MEMBER_SEARCH_THRESHOLD;
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = m.displayName?.trim() ? m.displayName.toLowerCase() : '';
      return name.includes(q) || m.email.toLowerCase().includes(q);
    });
  }, [members, query]);
  const isFiltering = query.trim().length > 0;

  return (
    <section
      className="tab-panel dashboard__members"
      role="tabpanel"
      id="dashboard-tabpanel-members"
      aria-labelledby="dashboard-tab-members"
      tabIndex={0}
    >
      <article className="pcard">
      <div className="pcard-body">
      <div className="narrow-center">
      {/* Judul kiri (Anggota — N + count kecil) + Undang kanan sejajar; search + list di bawah. */}
      <header className="page-header">
        <div>
          <h2 className="page-title">{t('dashboard.team.membersHeading', { count: members?.length ?? 0 })}</h2>
          <span className="data-list-count">{t('teams.memberCount', { count: members?.length ?? 0 })}</span>
        </div>
        {isAdmin && (
          <Button
            variant="secondary"
            size="md"
            className="dashboard__members-invite"
            leftIcon={<EnvelopeSimple size={13} aria-hidden="true" />}
            onClick={() => setInviteOpen(true)}
          >
            {t('teams.invite')}
          </Button>
        )}
      </header>

      {/* Local search — rendered only past the threshold, never in the URL. */}
      {showSearch && members !== null && !loadError && (
        <div className="dashboard__members-search" role="search" aria-label={t('dashboard.team.membersSearchAria')}>
          <MagnifyingGlass size={14} aria-hidden="true" className="dashboard__members-search-icon" />
          <input
            type="search"
            name="member-q"
            autoComplete="off"
            spellCheck={false}
            className="dashboard__members-search-input"
            placeholder={t('dashboard.team.membersSearchPlaceholder')}
            aria-label={t('dashboard.team.membersSearchAria')}
            value={query}
            maxLength={200}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="dashboard__members-search-clear"
              aria-label={t('dashboard.team.membersSearchClear')}
              onClick={() => setQuery('')}
            >
              <X size={12} weight="bold" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {loadError ? (
        <DataErrorState error={loadErrorRaw ?? loadError} onRetry={reloadMembersTab} retryLabel={t('dashboard.team.membersRetry')} />
      ) : members === null ? (
        <div
          className="dashboard__members-skeleton"
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={t('dashboard.team.membersLoading')}
        >
          <span className="sr-only">{t('dashboard.team.membersLoadingText')}</span>
          <div aria-hidden="true" className="dashboard__members-list">
            {[0, 1].map((i) => (
              <div key={i} className="data-row dashboard__members-row">
                <Skeleton style={{ width: 40, height: 40, borderRadius: 'var(--radius-pill)', flexShrink: 0 }} />
                <div className="data-row-main" style={{ gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Skeleton style={{ width: 120, height: 14 }} />
                    <Skeleton style={{ width: 48, height: 16, borderRadius: 'var(--radius-sm)' }} />
                  </div>
                  <Skeleton style={{ width: '60%', height: 11 }} />
                </div>
                <div className="data-row-side">
                  <Skeleton style={{ width: 72, height: 28, borderRadius: 'var(--radius-input)' }} />
                  <Skeleton style={{ width: 88, height: 28, borderRadius: 'var(--radius-input)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : members.length === 0 ? (
        <div className="page-empty">
          <EmptyState
            icon={<UsersThree size={22} weight="duotone" aria-hidden="true" />}
            title={t('teams.emptyTitle')}
            description={t('teams.emptyDescription')}
            action={
              isAdmin ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="dashboard__members-empty-invite"
                  leftIcon={<EnvelopeSimple size={13} aria-hidden="true" />}
                  onClick={() => setInviteOpen(true)}
                >
                  {t('teams.invite')}
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="page-empty">
          <EmptyState
            icon={<MagnifyingGlass size={22} weight="duotone" aria-hidden="true" />}
            title={t('dashboard.team.membersNoResultTitle', { query: query.trim() })}
            description={t('dashboard.team.membersNoResultDesc')}
            action={
              <Button variant="ghost" size="sm" onClick={() => setQuery('')}>
                {t('dashboard.team.membersClearFilter')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="dashboard__members-list" role="list" aria-label={t('dashboard.team.membersListAria')}>
          {filteredMembers.map((m) => {
            const isOwner = m.role === 'owner';
            // Viewer is read-only; admin manages roles/members; only owner can transfer.
            const roleOptions = isOwner || !isAdmin ? [] : team.role === 'owner' ? ALL_ROLES : CHANGEABLE_ROLES;
            const displayName = m.displayName?.trim() ? m.displayName : m.email;
            return (
              <div
                key={m.id}
                className="data-row dashboard__members-row"
                role="listitem"
              >
                <Avatar
                  src={(m as { avatarUrl?: string | null }).avatarUrl ?? null}
                  name={displayName}
                  email={m.email}
                  id={m.id}
                  size={40}
                  style={{ flexShrink: 0 }}
                />
                <div className="data-row-main">
                  <span className="data-row-title">
                    <span className="row-title-text">{displayName}</span>
                    <Badge tone={TEAM_ROLE[m.role].tone}>{TEAM_ROLE[m.role].label}</Badge>
                  </span>
                  <span className="data-row-meta">
                    {m.displayName?.trim()
                      ? `${m.email} · ${t('teams.joinedOn', { date: new Date(m.joinedAt).toLocaleDateString() })}`
                      : t('teams.joinedOn', { date: new Date(m.joinedAt).toLocaleDateString() })}
                  </span>
                </div>
                <div className="data-row-side">
                  {roleOptions.length > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setRoleError(null);
                        setRoleTarget(m);
                      }}
                      aria-label={t('teams.changeRoleModal.openAria', { name: displayName })}
                    >
                      {TEAM_ROLE[m.role].label} <span aria-hidden="true">▾</span>
                    </Button>
                  )}
                  {!isOwner && isAdmin && (
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<Trash size={13} aria-hidden="true" />}
                      loading={busyId === m.id}
                      onClick={() => {
                        setRemoveError(null);
                        setRemoveTarget(m);
                      }}
                    >
                      {t('teams.remove')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending invites stay admin-only, mirroring the team workspace. */}
      {isAdmin && pendingInvites !== null && pendingInvites.length > 0 && (
        <section className="dashboard__members-pending" aria-label={t('teams.pendingInvitations')}>
          <h3 className="panel-title text-muted">{t('teams.pendingInvitations')}</h3>
          <div className="dashboard__members-list">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="data-row dashboard__members-row">
                <div className="data-row-main">
                  <span className="data-row-title">
                    <span className="row-title-text">{inv.email}</span>
                    <Badge tone={TEAM_ROLE[inv.role].tone}>{TEAM_ROLE[inv.role].label}</Badge>
                  </span>
                  <span className="data-row-meta">
                    {t('teams.expiresOn', { date: new Date(inv.expiresAt).toLocaleDateString() })}
                  </span>
                </div>
                <div className="data-row-side dashboard__members-pending-actions">
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<Trash size={13} aria-hidden="true" />}
                    loading={busyId === inv.id}
                    onClick={() => {
                      setWithdrawError(null);
                      setWithdrawTarget(inv);
                    }}
                  >
                    {t('teams.withdraw')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reused dialogs — no duplicated modal implementations. */}
      <InviteModal
        teamId={team.id}
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          void refresh();
          void loadPendingInvites();
        }}
      />

      <ConfirmDeleteDialog
        open={!!removeTarget}
        title={t('teams.removeModal.title')}
        description={t('teams.removeModal.body', { name: removeTarget?.email ?? '', team: team.name })}
        confirmLabel={t('teams.removeModal.confirm')}
        busy={busyId === removeTarget?.id}
        error={removeError}
        onClose={() => {
          setRemoveTarget(null);
          setRemoveError(null);
        }}
        onConfirm={() => removeTarget && void onRemoveMember(removeTarget)}
      />

      <ConfirmDeleteDialog
        open={!!withdrawTarget}
        title={t('teams.withdrawModal.title')}
        description={t('teams.withdrawModal.body', { email: withdrawTarget?.email ?? '' })}
        confirmLabel={t('teams.withdraw')}
        busy={busyId === withdrawTarget?.id}
        error={withdrawError}
        onClose={() => {
          setWithdrawTarget(null);
          setWithdrawError(null);
        }}
        onConfirm={() => withdrawTarget && void onWithdrawInvite(withdrawTarget)}
      />

      <ChangeRoleModal
        open={!!roleTarget}
        member={roleTarget}
        teamRole={team.role}
        busy={roleBusy}
        error={roleError}
        onClose={() => setRoleTarget(null)}
        onConfirm={onConfirmRole}
      />

      {isFiltering && filteredMembers.length > 0 && (
        <p className="sr-only" role="status" aria-live="polite">
          {t('dashboard.team.membersListAria')}
        </p>
      )}
      </div>
      </div>
      </article>
    </section>
  );
}
