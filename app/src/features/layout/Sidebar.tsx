import { FolderSimple, Key, Robot, SignOut, SquaresFour } from '@phosphor-icons/react';
import { useAuth } from '../../state/auth-context';
import { useNavigation } from '../../state/navigation-context';
import { useProjects } from '../../state/projects-context';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { Skeleton } from '../../components/Skeleton';

export function Sidebar() {
  const { user, logout } = useAuth();
  const { projects } = useProjects();
  const { view, openDashboard, openProject, openKeys, openMcpGuide } = useNavigation();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Logo size={18} />
        <span>DevHub</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main">
        <button
          type="button"
          className={`sidebar-item ${view.name === 'dashboard' ? 'sidebar-item-active' : ''}`}
          onClick={openDashboard}
        >
          <SquaresFour size={15} weight="duotone" aria-hidden="true" />
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          className={`sidebar-item ${view.name === 'keys' ? 'sidebar-item-active' : ''}`}
          onClick={openKeys}
        >
          <Key size={15} weight="duotone" aria-hidden="true" />
          <span>API Keys</span>
        </button>
        <button
          type="button"
          className={`sidebar-item ${view.name === 'mcp' ? 'sidebar-item-active' : ''}`}
          onClick={openMcpGuide}
        >
          <Robot size={15} weight="duotone" aria-hidden="true" />
          <span>MCP Guide</span>
        </button>
      </nav>

      <div className="sidebar-section">Projects</div>
      <nav className="sidebar-nav sidebar-nav-grow" aria-label="Projects">
        {projects === null ? (
          <>
            <Skeleton className="sidebar-skeleton" />
            <Skeleton className="sidebar-skeleton" />
            <Skeleton className="sidebar-skeleton" />
          </>
        ) : (
          projects.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`sidebar-item ${
                view.name === 'project' && view.projectId === p.id ? 'sidebar-item-active' : ''
              }`}
              onClick={() => openProject(p.id)}
            >
              <FolderSimple size={14} weight="duotone" aria-hidden="true" />
              <span className="sidebar-item-label" title={p.name}>
                {p.name}
              </span>
            </button>
          ))
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="sidebar-user-email" title={user?.email}>
            {user?.email}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<SignOut size={14} aria-hidden="true" />}
          onClick={() => void logout()}
        >
          Sign out
        </Button>
      </div>
    </aside>
  );
}
