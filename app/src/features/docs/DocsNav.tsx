import { NavLink, type NavLinkProps } from 'react-router';
import { useTranslation } from 'react-i18next';

const tabClass: NavLinkProps['className'] = ({ isActive }) => `tab${isActive ? ' tab-active' : ''}`;

export function DocsNav() {
  const { t } = useTranslation('extras');
  return (
    <nav className="tabs docs-nav" aria-label={t('docs.navAria')}>
      <NavLink to="/docs" end className={tabClass}>
        {t('docs.nav.overview')}
      </NavLink>
      <NavLink to="/docs/mcp" end className={tabClass}>
        {t('docs.nav.mcp')}
      </NavLink>
    </nav>
  );
}
