import { Plus } from '@phosphor-icons/react';
import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { avatarColor, initialsOf as avatarInitials } from '../../lib/avatar';

interface TeamRailProps {
  teams: { id: string; name: string; memberCount: number }[] | null;
  activeTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  onCreateTeam: () => void;
}

export function TeamRail({ teams, activeTeamId, onSelectTeam, onCreateTeam }: TeamRailProps) {
  const { t } = useTranslation('shell');

  return (
    <nav className="team-rail" aria-label="Teams">
      <div className="team-rail-list" role="list">
        {teams === null ? (
          <>
            <div className="skeleton team-rail-skeleton" aria-hidden="true" />
            <div className="skeleton team-rail-skeleton" aria-hidden="true" />
            <div className="skeleton team-rail-skeleton" aria-hidden="true" />
          </>
        ) : teams.length === 0 ? (
          <div className="team-rail-empty" title={t('sidebar.noTeamsYet')}>
            —
          </div>
        ) : (
          teams.map((team) => {
            const isActive = team.id === activeTeamId;
            const initials = avatarInitials(team.name);
            const bg = avatarColor(team.id);
            return (
              <button
                key={team.id}
                type="button"
                role="listitem"
                className={`team-rail-item${isActive ? ' team-rail-item-active' : ''}`}
                aria-label={`${team.name}, ${team.memberCount} members`}
                aria-current={isActive ? 'true' : undefined}
                title={`${team.name} — ${team.memberCount} members`}
                onClick={() => onSelectTeam(team.id)}
                style={{ background: isActive ? bg : undefined }}
              >
                <span className="team-rail-initials" aria-hidden="true">
                  {initials.slice(0, 2)}
                </span>
                {isActive && <span className="team-rail-active-dot" aria-hidden="true" />}
              </button>
            );
          })
        )}
      </div>

      <div className="team-rail-footer">
        <button
          type="button"
          className="team-rail-add"
          aria-label={t('sidebar.newTeam')}
          title={t('sidebar.newTeam')}
          onClick={onCreateTeam}
        >
          <Plus size={16} weight="bold" aria-hidden="true" />
        </button>
        <NavLink to="/docs" className="team-rail-docs" aria-label={t('sidebar.docs')} title={t('sidebar.docs')}>
          ?
        </NavLink>
      </div>
    </nav>
  );
}
