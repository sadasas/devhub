// Shared section keys for the team-settings shell (?section=).
// 'billing' is the legacy deep-link (?tab=settings&section=billing) and
// maps to Usage; unknown values fall back to General. 'github' is a
// coming-soon placeholder panel (DEF-013) — real repo linking lands there.
export const SETTINGS_SECTIONS = ['general', 'plan', 'usage', 'danger', 'github'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function normalizeSettingsSection(raw: string | null): SettingsSection {
  if (raw === 'billing') return 'usage';
  return (SETTINGS_SECTIONS as readonly string[]).includes(raw ?? '')
    ? (raw as SettingsSection)
    : 'general';
}

// Sub-setting keyword index (i18n keys under the account namespace) so the
// settings search finds field/sub-section titles, e.g. "url" → Umum via
// "URL tim". Resolved + matched in SettingsNav; nothing here is rendered.
export const SETTINGS_SUB_KEYS: Record<SettingsSection, string[]> = {
  general: [
    'dashboard.team.settingsIconLabel',
    'dashboard.team.settingsNameLabel',
    'dashboard.team.settingsSlugLabel',
    'dashboard.team.settingsIdLabel',
    'dashboard.team.settingsSave',
  ],
  plan: [
    'teams.billing.members',
    'teams.billing.projects',
    'dashboard.team.settingsPlanManage',
  ],
  usage: [
    'dashboard.team.settingsUsageViewHistory',
    'teams.billing.viewPricing',
  ],
  github: [
    'dashboard.team.settingsGithubSoonItem1',
    'dashboard.team.settingsGithubSoonItem2',
    'dashboard.team.settingsGithubSoonItem3',
  ],
  danger: [
    'teams.leaveTeam',
    'teams.deleteTeam',
  ],
};
