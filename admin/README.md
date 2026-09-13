# DevHub Admin

Platform admin untuk DevHub — overview, users, teams, payments, packages.

Sama stack dengan `app`: Vite + React 19 + TypeScript.

## Dev

```bash
npm install
npm run dev -w admin        # atau dari root: npm run dev:admin
```

Env:
```
VITE_API_URL=http://localhost:3000/api/v1
# untuk proxy local: VITE_API_PROXY_TARGET=http://localhost:3000
```

Auth pakai cookie httpOnly sama dengan `app` (credentials:include). Login sebagai user dengan `role='admin'`:
```sql
UPDATE users SET role='admin' WHERE email='you@example.com';
```

## Build & Deploy (Cloudflare Dashboard)

- Root directory: `admin`
- Build command: `npm run build` (guard same-origin + `tsc -b` + `vite build`)
- Output: `dist`
- Env `VITE_API_URL=/api/v1` set di dashboard, Production dan Preview (baked at build;
  runtime `src/lib/api.ts` memaksa relatif bila nilai absolut cross-site lolos)

Worker `devhub-admin` (`wrangler.json`: `main: ./src/worker.ts`,
`run_worker_first: true`, `vars.SUGA_ORIGIN`) mem-proxy `/api/*`, `/mcp`,
`/oauth/*`, `/ws`, `/.well-known/*` ke Suga dan serve `dist` untuk sisanya
(SPA fallback via `assets.not_found_handling: single-page-application`).
**Setiap frontend HARUS punya Worker proxy — jangan deploy admin yang
memanggil Suga absolut (ADR-051).**

## Env Server

Tidak perlu `CORS_ORIGIN` untuk admin (same-origin via Worker proxy — biarkan
kosong). Single login app + admin memakai parent-domain cookie (ADR-051):

```
COOKIE_DOMAIN=.nrawangbatin.my.id
```

`COOKIE_SECURE=true`, `TRUST_PROXY=true`. Pola lama split-origin
(`CORS_ORIGIN` + `SameSite=None`) sudah pensiun — jangan dihidupkan lagi.
