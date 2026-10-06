// Sumber tunggal URL publik aplikasi DevHub untuk dokumentasi.
//
// Nilai TERBUKTI hidup (2026-10-06): OAuth discovery 200 +
// metadata resource {"resource":"https://app.devhub.nrawangbatin.my.id/mcp"}.
// Aturan: JANGAN tulis URL /mcp literal di file docs — impor MCP_URL dari sini
// (lihat devhub-docs mcp.mdx). Guard: devhub-docs/scripts/guard-mcp-urls.mjs.
export const APP_URL = 'https://app.devhub.nrawangbatin.my.id';
export const MCP_URL = `${APP_URL}/mcp`;
