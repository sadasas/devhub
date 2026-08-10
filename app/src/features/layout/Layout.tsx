import { useNavigation } from '../../state/navigation-context';
import { Sidebar } from './Sidebar';
import { DashboardPage } from '../dashboard/DashboardPage';
import { ProjectPage } from '../project/ProjectPage';
import { KeysPage } from '../keys/KeysPage';
import { McpDocsPage } from '../mcp/McpDocsPage';

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
        ) : (
          <ProjectPage projectId={view.projectId} />
        )}
      </main>
    </div>
  );
}
