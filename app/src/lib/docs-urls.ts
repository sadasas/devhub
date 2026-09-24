/**
 * Single source of truth untuk URL docs site kanonis.
 * Satu tempat ubah bila domain docs berpindah.
 * App tidak lagi menyimpan ringkasan legal — isi lengkap hanya di docs site.
 */
export const DOCS_BASE_URL = 'https://docs.devhub.nrawangbatin.my.id';
export const DOCS_HOME_URL = 'https://docs.devhub.nrawangbatin.my.id/';
export const DOCS_PRIVACY_URL = 'https://docs.devhub.nrawangbatin.my.id/privacy';
export const DOCS_TERMS_URL = 'https://docs.devhub.nrawangbatin.my.id/terms';
export const DOCS_MCP_URL = 'https://docs.devhub.nrawangbatin.my.id/mcp';
/** Revoke + kebijakan pihak ketiga untuk disclosure integrasi (single source, jangan hardcode di komponen). */
export const GOOGLE_ACCOUNT_PERMISSIONS_URL = 'https://myaccount.google.com/permissions';
export const GOOGLE_API_USER_DATA_POLICY_URL = 'https://developers.google.com/terms/api-services-user-data-policy';
export const GITHUB_INSTALLATIONS_URL = 'https://github.com/settings/installations';
export const GITHUB_PRIVACY_URL = 'https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement';
