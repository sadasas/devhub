// Section keys for the project-settings shell (?tab=settings&section=).
// Mirrors team settings (?section=) but scoped to one project: 'general'
// (meta), 'labels' (task label definitions), 'integrations' (provider cards)
// and 'danger' (archive + delete).
// Unknown values fall back to General.
export const PROJECT_SETTINGS_SECTIONS = ['general', 'labels', 'integrations', 'danger'] as const;
export type ProjectSettingsSection = (typeof PROJECT_SETTINGS_SECTIONS)[number];

export function normalizeProjectSettingsSection(raw: string | null): ProjectSettingsSection {
  return (PROJECT_SETTINGS_SECTIONS as readonly string[]).includes(raw ?? '')
    ? (raw as ProjectSettingsSection)
    : 'general';
}

// Tab board yang sah untuk ?from= (tombol back settings). Duplikasi sadar
// dari TABS ProjectPage agar layout tak bergantung pada komponen halaman.
export const PROJECT_TAB_IDS = [
  'board',
  'issues',
  'tests',
  'stack',
  'schema',
  'decisions',
  'releases',
  'api',
  'overview',
  'whiteboard',
] as const;
export type ProjectTabId = (typeof PROJECT_TAB_IDS)[number];

export function normalizeProjectTabId(raw: string | null): ProjectTabId {
  return (PROJECT_TAB_IDS as readonly string[]).includes(raw ?? '')
    ? (raw as ProjectTabId)
    : 'board';
}

// Sub-setting keyword index (i18n keys under the project namespace) —
// reserved for a future settings search like SettingsNav; nothing rendered.
export const PROJECT_SETTINGS_SUB_KEYS: Record<ProjectSettingsSection, string[]> = {
  general: [
    'project.settings.nameLabel',
    'project.settings.descLabel',
    'project.settings.idLabel',
  ],
  integrations: ['project.settings.integrationsTitle'],
  labels: [
    'project.settings.labelsTitle',
    'project.settings.labelsAdd',
  ],
  danger: [
    'project.settings.dangerArchiveName',
    'project.settings.dangerDeleteName',
  ],
};
