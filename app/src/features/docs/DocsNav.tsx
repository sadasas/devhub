import { NavLink, type NavLinkProps } from 'react-router';

const tabClass: NavLinkProps['className'] = ({ isActive }) => `tab${isActive ? ' tab-active' : ''}`;

export function DocsNav() {
  return (
    <nav className="tabs docs-nav" aria-label="Docs sections">
      <NavLink to="/docs" end className={tabClass}>
        Overview
      </NavLink>
      <NavLink to="/docs/mcp" className={tabClass}>
        MCP Integration
      </NavLink>
    </nav>
  );
}