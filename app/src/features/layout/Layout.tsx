import { useNavigation } from '../../state/navigation-context';
import { Sidebar } from './Sidebar';
import { DashboardPage } from '../dashboard/DashboardPage';
import { ProjectPage } from '../project/ProjectPage';
import { KeysPage } from '../keys/KeysPage';
import { McpDocsPage } from '../mcp/McpDocsPage';
import { TeamPage } from '../teams/TeamPage';
import { InvitesPage } from '../teams/InvitesPage';

export function Layout() {
  const { view } = useNavigation();
  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        {view.name === 'dashboard' ? (
          <DashboardPage />
        ) : view.name === 'keys' ? (
          <KeysPage />
        ) : view.name === 'mcp' ? (
          <McpDocsPage />
        ) : view.name === 'team' ? (
          <TeamPage teamId={view.teamId} />
        ) : view.name === 'invites' ? (
          <InvitesPage />
        ) : (
          <ProjectPage projectId={view.projectId} />
        )}
      </main>
    </div>
  );
}
