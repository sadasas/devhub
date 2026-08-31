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
- Build command: `npm run build`
- Output: `dist`
- Framework: Vite
- Env `VITE_API_URL` set di dashboard (baked at build)

Cloudflare Pages akan handle SPA fallback via `wrangler.json` `assets.not_found_handling: single-page-application`.

## Env Server

Tambah origin admin ke `CORS_ORIGIN` di server:
```
CORS_ORIGIN=https://devhub.pages.dev,https://devhub-admin.pages.dev
```
dan pastikan `COOKIE_SECURE=true`, `TRUST_PROXY=true` serta cookie `SameSite=None; Secure` untuk cross-site jika domain berbeda.
