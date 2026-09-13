// Guard: pastikan logika force-relatif VITE_API_URL tetap ada (mirror
// app/scripts/guard-vite-api-url.mjs, tanpa realtime-client — admin tidak
// punya WS client).
// Latar: SPA + API satu origin via Worker proxy (admin host → Suga).
// admin/src/lib/api.ts memaksa '/api/v1' bila VITE_API_URL absolut cross-site
// lolos ke build — tanpa ini cookie sesi (first-party Lax, ADR-051) tidak ikut
// terkirim dan login loop 401. Guard ini menggagalkan build bila pola hilang.
// Jalan: node admin/scripts/guard-vite-api-url.mjs (lihat package.json build/guard:api-base).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const adminDir = path.resolve(root, '..');

const checks = [
  {
    file: 'src/lib/api.ts',
    mustContain: ['forceRelativeApiBase', '!== envOrigin', "return '/api/v1'"],
  },
];

let failed = false;
for (const { file, mustContain } of checks) {
  const full = path.join(adminDir, file);
  let src = '';
  try {
    src = readFileSync(full, 'utf8');
  } catch (err) {
    console.error(`[guard:api-base] FAIL: tidak bisa membaca ${file}: ${err instanceof Error ? err.message : err}`);
    failed = true;
    continue;
  }
  for (const needle of mustContain) {
    if (!src.includes(needle)) {
      console.error(`[guard:api-base] FAIL: ${file} kehilangan pola wajib ${JSON.stringify(needle)}`);
      console.error(
        `[guard:api-base] JANGAN deploy dengan VITE_API_URL absolut cross-site — kembalikan logika force-relatif (api.ts).`,
      );
      failed = true;
    }
  }
}

// Nilai build-time absolut cross-site tidak boleh menjadi API_BASE runtime.
// Pemeriksaan statis di atas menjamin force-relatif; bila env build masih absolut,
// runtime menimpa ke '/api/v1' — beri peringatan eksplisit agar operator sadar.
const envVal = (process.env.VITE_API_URL ?? '').trim();
if (/^https?:\/\//i.test(envVal) && envVal !== '/api/v1') {
  console.warn(
    `[guard:api-base] WARN: VITE_API_URL=${JSON.stringify(envVal)} absolut — runtime memaksa '/api/v1' same-origin. Set VITE_API_URL=/api/v1 agar build bersih.`,
  );
}

if (failed) {
  process.exit(1);
}
console.log('[guard:api-base] OK: force-relatif same-origin utuh (api.ts).');
