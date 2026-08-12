import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    <div className="layout">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar />
      <main className="main" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
