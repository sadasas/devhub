import { useNavigation } from '../../state/navigation-context';
import { Sidebar } from './Sidebar';
import { DashboardPage } from '../dashboard/DashboardPage';
import { ProjectPage } from '../project/ProjectPage';

export function Layout() {
  const { view } = useNavigation();
  return (
    <div className="layout">
      <Sidebar />
      <main className="main">
        {view.name === 'dashboard' ? <DashboardPage /> : <ProjectPage projectId={view.projectId} />}
      </main>
    </div>
  );
}
