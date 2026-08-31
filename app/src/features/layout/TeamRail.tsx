import { CaretDoubleLeft, CaretDoubleRight, Plus, SquaresFour } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { avatarColor, initialsOf as avatarInitials } from '../../lib/avatar';
import { useAuth } from '../../state/auth-context';
import { initialsOf } from '../../lib/initials';

interface TeamRailProps {
  teams: { id: string; name: string; icon?: string | null; memberCount: number }[] | null;
  activeTeamId: string | null;
  activeMain?: 'home' | 'team';
  compact?: boolean;
  collapsed?: boolean;
  hoveredId?: string | null;
  onToggleCollapsed?: () => void;
  onSelectTeam: (teamId: string) => void;
  onSelectHome: () => void;
  onCreateTeam: () => void;
  onHoverItem?: (id: string | null) => void;
}

export function TeamRail({ teams, activeTeamId, activeMain = 'team', compact = false, collapsed = false, hoveredId = null, onToggleCollapsed, onSelectTeam, onSelectHome, onCreateTeam, onHoverItem }: TeamRailProps) {
  const { t } = useTranslation('shell');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isHomeActive = activeMain === 'home';

  return (
    <nav className={`team-rail ${compact ? 'team-rail-compact' : ''}`} aria-label="Teams">
      <button
        type="button"
        className={`team-rail-home${isHomeActive ? ' team-rail-home-active' : ''}${hoveredId === 'home' ? ' team-rail-home-hovered' : ''}`}
        aria-label={t('sidebar.dashboard')}
        aria-current={isHomeActive ? 'page' : undefined}
        aria-expanded={hoveredId === 'home' ? true : undefined}
        aria-controls="sidebar-region"
        title={t('sidebar.dashboard')}
        onClick={onSelectHome}
        onPointerEnter={() => onHoverItem?.('home')}
        onPointerLeave={(e) => {
          const rt = e.relatedTarget as Node | null;
          if (rt && document.getElementById('sidebar-region')?.contains(rt)) return;
          onHoverItem?.(null);
        }}
        onFocus={() => onHoverItem?.('home')}
        onBlur={(e) => {
          const rt = e.relatedTarget as Node | null;
          if (rt && (document.getElementById('sidebar-region')?.contains(rt) || (e.currentTarget as HTMLElement).closest('.desktop-sidebar-group')?.contains(rt))) return;
          onHoverItem?.(null);
        }}
      >
        <SquaresFour size={18} weight={isHomeActive ? 'fill' : 'duotone'} aria-hidden="true" />
        <span className="team-rail-home-label">{t('sidebar.dashboard')}</span>
      </button>

      <div className="team-rail-divider" aria-hidden="true" />

      <div className="team-rail-section-label">Teams</div>
      <div className="team-rail-list" role="list">
        {teams === null ? (
          <>
            <div className="skeleton team-rail-skeleton" aria-hidden="true" />
            <div className="skeleton team-rail-skeleton" aria-hidden="true" />
            <div className="skeleton team-rail-skeleton" aria-hidden="true" />
          </>
        ) : teams.length === 0 ? (
          <div className="team-rail-empty" title={t('sidebar.noTeamsYet')}>
            No teams
          </div>
        ) : (
          teams.map((team) => {
            const isActive = team.id === activeTeamId && activeMain === 'team';
            const isHovered = hoveredId === team.id;
            const initials = avatarInitials(team.name);
            const bg = avatarColor(team.id);
            const hasIcon = Boolean(team.icon?.trim());
            return (
              <button
                key={team.id}
                type="button"
                role="listitem"
                className={`team-rail-item${isActive ? ' team-rail-item-active' : ''}${isHovered ? ' team-rail-item-hovered' : ''}`}
                aria-label={`${team.name}, ${team.memberCount} members`}
                aria-current={isActive ? 'true' : undefined}
                aria-expanded={isHovered ? true : undefined}
                aria-controls="sidebar-region"
                title={`${team.name} — ${team.memberCount} members`}
                onClick={() => onSelectTeam(team.id)}
                onPointerEnter={() => onHoverItem?.(team.id)}
                onPointerLeave={(e) => {
                  const rt = e.relatedTarget as Node | null;
                  if (rt && document.getElementById('sidebar-region')?.contains(rt)) return;
                  onHoverItem?.(null);
                }}
                onFocus={() => onHoverItem?.(team.id)}
                onBlur={(e) => {
                  const rt = e.relatedTarget as Node | null;
                  if (rt && (document.getElementById('sidebar-region')?.contains(rt) || (e.currentTarget as HTMLElement).closest('.desktop-sidebar-group')?.contains(rt))) return;
                  onHoverItem?.(null);
                }}
              >
                <span
                  className="team-rail-icon"
                  style={hasIcon ? { background: 'transparent', fontSize: 16, border: '1px solid var(--border-hairline)' } : { background: bg }}
                  aria-hidden="true"
                >
                  {hasIcon ? team.icon!.trim() : initials.slice(0, 2)}
                  {team.memberCount > 0 && (
                    <span className="team-rail-icon-bubble" aria-hidden="true">
                      {team.memberCount > 99 ? '99+' : team.memberCount}
                    </span>
                  )}
                </span>
                <span className="team-rail-name" title={team.name}>
                  {team.name}
                </span>
                <span className="team-rail-count" aria-hidden="true">
                  {team.memberCount}
                </span>
              </button>
            );
          })
        )}
      </div>

      <button
        type="button"
        className="team-rail-create"
        aria-label={t('sidebar.newTeam')}
        title={t('sidebar.newTeam')}
        onClick={onCreateTeam}
      >
        <Plus size={14} weight="bold" aria-hidden="true" />
        <span>New team</span>
      </button>

      <div className="team-rail-bottom">
        {onToggleCollapsed && (
          <button
            type="button"
            className="team-rail-collapse"
            aria-label={collapsed ? t('layout.expandSidebar', { defaultValue: 'Expand sidebar' }) : t('layout.collapseSidebar', { defaultValue: 'Collapse sidebar' })}
            aria-expanded={!collapsed}
            aria-controls="sidebar-region"
            title={collapsed ? 'Expand (Ctrl+B)' : 'Collapse (Ctrl+B)'}
            onClick={onToggleCollapsed}
          >
            {collapsed ? <CaretDoubleRight size={14} weight="bold" aria-hidden="true" /> : <CaretDoubleLeft size={14} weight="bold" aria-hidden="true" />}
          </button>
        )}

        <div className="team-rail-footer-account">
        <button
          type="button"
          className="team-rail-account"
          aria-label={t('sidebar.profile')}
          title={user?.email ?? t('sidebar.profile')}
          onClick={() => navigate('/profile')}
        >
          <span className="team-rail-avatar" aria-hidden="true">
            {user ? initialsOf(user.displayName, user.email) : '?'}
          </span>
          <span className="team-rail-account-meta">
            <span className="team-rail-account-name" title={user?.displayName || user?.email}>
              {user?.displayName.trim() || user?.email || 'Account'}
            </span>
            <span className="team-rail-account-email">{user?.email}</span>
          </span>
        </button>
        <button
          type="button"
          className="team-rail-signout"
          aria-label={t('sidebar.signOut')}
          title={t('sidebar.signOut')}
          onClick={() => void logout()}
        >
          ⎋
        </button>
        </div>
      </div>
    </nav>
  );
}
