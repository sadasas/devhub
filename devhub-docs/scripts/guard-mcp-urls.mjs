// Guard: URL MCP di docs tidak boleh hardcode basi/drift.
// Latar: docs public pernah menulis https://devhub.nrawangbatin.my.id/mcp
// sementara host hidup (terbukti discovery 200 + metadata resource) adalah
// https://app.devhub.nrawangbatin.my.id/mcp — tanpa ada yang notice.
// Sumber tunggal: devhub-docs/src/site-urls.ts (APP_URL -> MCP_URL).
// Aturan:
//   1. File *.mdx docs DILARANG memuat literal https://.../mcp (wajib {MCP_URL}).
//   2. File .md engineering (docs/03-engineering, docs/02-architecture) yang
//      menyebut /mcp WAJIB sama persis dengan MCP_URL dari sumber tunggal.
// Gagal = exit 1. Jalan: node devhub-docs/scripts/guard-mcp-urls.mjs
// (lihat devhub-docs/package.json build).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(root, '..');
const repoDir = path.resolve(docsDir, '..');

// Ambil APP_URL dari sumber tunggal (tanpa mengeksekusi TS — regex literal).
const siteUrls = readFileSync(path.join(docsDir, 'src', 'site-urls.ts'), 'utf8');
const appUrlMatch = siteUrls.match(/APP_URL\s*=\s*'([^']+)'/);
if (!appUrlMatch) {
  console.error('[guard:mcp-urls] FAIL: APP_URL tidak ditemukan di src/site-urls.ts');
  process.exit(1);
}
const expectedMcp = `${appUrlMatch[1].replace(/\/$/, '')}/mcp`;
const apexMcp = 'https://devhub.nrawangbatin.my.id/mcp';

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => full.endsWith(e))) out.push(full);
  }
  return out;
}

const literalMcpRe = /https:\/\/[^\s"'`()]+?\/mcp/g;
let failed = false;

// 1. MDX docs: nol literal /mcp — wajib via {MCP_URL}.
for (const file of walk(path.join(docsDir, 'src'), ['.mdx'])) {
  const src = readFileSync(file, 'utf8');
  const hits = src.match(literalMcpRe) ?? [];
  if (hits.length > 0) {
    console.error(`[guard:mcp-urls] FAIL: ${path.relative(repoDir, file)} memuat URL /mcp literal: ${hits.join(', ')}`);
    console.error('[guard:mcp-urls]   Pakai {MCP_URL} dari site-urls.ts, bukan string statis.');
    failed = true;
  }
}

// 2. Plain-md engineering/architecture: literal /mcp harus == sumber tunggal.
const plainMd = [
  'docs/03-engineering/mcp-integration.md',
  'docs/02-architecture/adr.md',
  'docs/02-architecture/technical-design.md',
];
for (const rel of plainMd) {
  const full = path.join(repoDir, rel);
  let src = '';
  try {
    src = readFileSync(full, 'utf8');
  } catch {
    console.error(`[guard:mcp-urls] FAIL: tidak bisa membaca ${rel}`);
    failed = true;
    continue;
  }
  for (const hit of src.match(literalMcpRe) ?? []) {
    if (hit !== expectedMcp) {
      console.error(`[guard:mcp-urls] FAIL: ${rel} memakai ${hit}, sumber tunggal = ${expectedMcp}`);
      failed = true;
    }
  }
}

// 3. Bekas pola basi apex+/mcp tidak boleh muncul di mana pun (docs + engineering).
const apexHits = [];
for (const file of [
  ...walk(path.join(docsDir, 'src'), ['.md', '.mdx']),
  ...plainMd.map((r) => path.join(repoDir, r)),
]) {
  const src = readFileSync(file, 'utf8');
  if (src.includes(apexMcp)) apexHits.push(path.relative(repoDir, file));
}
if (apexHits.length > 0) {
  console.error(`[guard:mcp-urls] FAIL: pola basi ${apexMcp} masih ada di: ${apexHits.join(', ')}`);
  failed = true;
}

if (failed) process.exit(1);
console.log(`[guard:mcp-urls] OK: nol literal di mdx, plain-md == ${expectedMcp}.`);
