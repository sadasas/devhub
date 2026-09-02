# Coding Standards — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-10 |
| **Applies to** | All TypeScript code in `app/` and `server/` |

---

## 1. Language & Tooling

| Item | Standard |
|---|---|
| Language | TypeScript (strict mode) — `strict: true`, `noUncheckedIndexedAccess` |
| Node version | ≥ 22 (dev), `node:22-alpine` (prod image) |
| Formatting | Prettier (single config, `semi: true`, `singleQuote: false`, `printWidth: 100`) |
| Linting | ESLint flat config; no `any` (except zod-unknown JSON boundaries with explicit casts) |
| Tests | vitest (unit/integration); Playwright (E2E, Phase 2) |
| Package manager | npm ≥ 10; `package-lock.json` committed |
| Scripts | All via root `package.json` workspace scripts (`npm run dev`, `build`, `test`, `db:migrate`) |

---

## 2. Repository Layout

```
devhub/
├── app/                     # Vite React app
│   └── src/
│       ├── components/      # Design-system primitives (pure, no feature logic)
│       ├── features/        # One folder per tab/feature: board/, issues/, keys/, schema/, ...
│       │   └── <feature>/   #   <feature>Page.tsx, <feature>Reducer.ts, components/
│       ├── lib/             # api.ts (ApiProvider), types.ts, utils/
│       ├── state/           # store context, actions, selectors
│       └── styles/          # tokens.css, global.css, fonts.css
├── server/
│   └── src/
│       ├── api/             # routers: auth.routes.ts, projects.routes.ts, keys.routes.ts, state.routes.ts
│       ├── auth/            # password.ts, jwt.ts, middleware/requireAuth.ts
│       ├── db/              # pool.ts, migrations/, migrate.ts
│       ├── mcp/             # server.ts, context.ts, keys.ts, require-key.ts, tools/ (one file per tool)
│       ├── schema/          # zod schemas (shared shape with app types)
│       └── app.ts, index.ts
├── docs/                    # this documentation suite
└── docker-compose.yml, Dockerfile
```

---

## 3. TypeScript Rules

- **Types over interfaces** for object shapes that can be composed (`type` preferred); interfaces only for class-like contracts.
- `types.ts` in `app/src/lib` defines the 10 entities + state shape; `server/src/modules/projects/domain` (state.ts) mirrors them as zod schemas. The API contract between them must stay in sync — **any change updates both files in the same PR**.
- Enums: use `as const` string unions (`type TaskStatus = 'todo' | 'inProgress' | 'review' | 'done'`) — not TS `enum`.
- Never import server code into `app/` (or vice versa) across the package boundary; share types by duplication + sync rule (or a `shared/` package in Phase 2 if drift becomes painful).
- Dates: ISO 8601 strings (`new Date().toISOString()`), stored as strings; no JS `Date` objects in state.

```ts
// Good
export type TaskStatus = 'todo' | 'inProgress' | 'review' | 'done';

// Bad
enum TaskStatus { Todo, InProgress, Review, Done }
```

---

## 4. Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Files | kebab-case | `board-page.tsx`, `state.routes.ts` |
| React components | PascalCase | `BoardPage`, `TaskCard` |
| Functions/variables | camelCase | `createTask`, `blockedBy` |
| Constants (module-level) | UPPER_SNAKE_CASE | `JWT_COOKIE_NAME`, `MAX_BODY_BYTES` |
| CSS custom properties | kebab-case | `--surface-1`, `--radius-card` |
| Store actions | verb + noun past/present | `tasks.create`, `tasks.updateStatus` |
| API routes | kebab-case paths, REST verbs | `PUT /api/projects/:id/state` |

---

## 5. React Component Standards

- **Function components only.** No class components.
- **Props:** explicit types, `readonly`-style purity; destructure at top.
- **State:** local `useState` for isolated UI; `useReducer` for feature state; global project state via the single `Store` context.
- **No `useState` for pointer/scroll tracking** — use refs + CSS for hover/drag states (drag-drop is transient, driven by DnD events).
- **Memoization:** `React.memo` only where profiling shows benefit (list items in Kanban columns).
- **Effects:** every `useEffect` has a cleanup where needed (polling, listeners); polling only while tab visible (document.visibilitychange).
- **Accessibility:** labels above inputs (never placeholder-as-label), error text below inputs, `aria-*` on all interactive custom elements, buttons reachable by keyboard, focus ring always visible.
- **Motion:** only transform/opacity; `:active` scale 0.98 tactile feedback; all animations gated by `@media (prefers-reduced-motion: no-preference)`.

---

## 6. Design System Usage (tokens & components)

**Tokens live in `app/src/styles/tokens.css`** — never hardcode raw hex in components.

| Token group | Examples |
|---|---|
| Surfaces | `--surface-0` (zinc-950 base), `--surface-1` (zinc-900), `--surface-2` (zinc-800) |
| Text | `--text-primary`, `--text-secondary`, `--text-muted` |
| Border | `--border-hairline: rgba(255,255,255,0.08)` |
| Accent | `--accent` (emerald, desaturated) + hover/active variants |
| Status | `--status-danger`, `--status-warn`, `--status-success` (same family as accent) |
| Radius | `--radius-card: 8px`, `--radius-input: 6px`, `--radius-pill: 9999px` |
| Z-index | `--z-nav: 10`, `--z-palette: 30`, `--z-modal: 40`, `--z-overlay: 50` |
| Fonts | `--font-sans` (Geist), `--font-mono` (Geist Mono) |

**Component rules:**
- Build with primitives from `app/src/components/` (Button, Input, Badge, Modal, Skeleton, EmptyState, Toast). Do not reinvent them.
- Numbers and task IDs render in `--font-mono` (density ≥ 7 rule).
- One accent color globally; semantic colors only for status meaning (Color Consistency Lock).
- Radius/z-index ONLY from the documented scales.

---

## 7. Error Handling

- **Server:** every route wraps handlers in async error boundary → central error middleware → JSON `{ error: { code, message } }`. Known errors: `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `RATE_LIMITED`, `INTERNAL`.
- **Client:** ApiProvider normalizes errors; forms show inline errors under fields; destructive actions confirm; transient failures surface via Toast; never silent-catch state-write failures.
- **Never** log passwords, tokens, or cookie contents (see [Security Design](security-design.md)).

---

## 8. State & Data Rules

- The project state shape is defined once in `app/src/lib/types.ts`; the reducer is the **only** mutator of in-memory state.
- Immutability: spread/update patterns; no direct mutation; `updatedAt` refreshed on every mutation.
- Persistence: reducer → `StorageProvider` abstraction (`apiProvider` default; granular entity CRUD with `If-Match` optimistic locking); debounced ~800ms coalesced mutation queue in `ProjectProvider`, flush with keepalive on `pagehide`; `409` → LWW sync reconcile then conflict banner (banner only when local changes cannot be merged). Offline layer (M11): `ProjectPage` uses the `offlineProvider` wrapper (network-first `loadState` with IndexedDB cache fallback on network errors; every dispatched mutation journaled to IndexedDB and hydrated back on mount for replay; `fake-indexeddb` in tests). Sync service (M11): `app/src/lib/sync-service.ts` — `reconcileQueue` merges pending mutations against the fresh server snapshot per-entity with LWW on `updatedAt` (local entity from reducer state, delete-wins for deletes, capped at 3 reconcile attempts per flush); an `online` listener flushes pending work when connectivity returns. Offline shell bootstrap (M11): `auth-context`, `projects-context` and `teams-context` cache their last successful payloads in the IDB `meta` store (`getMeta`/`putMeta`, DB v2); on a **network error only** (not 401) they hydrate from the cache, so the app shell (user, projects list, teams, per-project state) boots offline from IndexedDB. Trust note: a cached session is a local hint — the server-side cookie still governs access once online (`/me` 401 → logout).
- Realtime (M12): `ProjectProvider` opens one `RealtimeSocket` (`app/src/lib/realtime-client.ts`) per project to the server `/ws` endpoint (same-origin or derived from `VITE_API_URL`). The server broadcasts `state:diff` (entity-level ops with full `after` entity) and `state:sync` (coarse "refetch" signal) into `project:{id}` rooms. The client applies diffs with `applyStateDiff` (pure: created→append, updated→replace in place, deleted→remove), skipping ops whose `entity:id` matches a pending local mutation, and only when `diff.version > versionRef`. `state:sync` and reconnect (`joined`) trigger a full `loadState` resync. Own edits are never re-applied from the socket; conflicts stay handled by the 409/LWW reconcile path. Presence: server broadcasts `{type:'presence', projectId, users:[{userId, name}]}` on join/leave/close (display_name from `users`); client keeps `presence` in `ProjectContext` and renders `PresenceChip` in the ProjectPage header (badge-info "N online" + tooltip, deduped names, hidden when empty).
- ID generation: `crypto.randomUUID()`.
- Export/import: `JSON.stringify` of state; import validated against the zod schema (shared contract) before acceptance.

---

## 9. CSS Standards

- Native CSS with custom properties; no CSS-in-JS, no Tailwind (locked zero-dep design).
- Class naming: BEM-lite (`board__column`, `board__column--active`).
- Layout: CSS Grid for multi-column layouts (no flex percentage math).
- Responsive: breakpoints sm 640 / md 768 / lg 1024 / xl 1280; dashboards degrade to single column below md.
- No `h-screen`; use `min-height: 100dvh` for shells.
- No pure black/white (`#000`/`#fff`); surfaces from token scale.

---

## 9b. i18n Standards (ADR-046, M36)

- Library: `react-i18next` v17; instance global di `app/src/i18n/index.ts` (`.use(initReactI18next)`, `react.useSuspense:false`). Jangan buat instance baru.
- Bahasa: **EN default + ID**; resolusi awal: `localStorage('devhub.lang')` → browser `id*` → `en`. Persistensi hanya localStorage; `<html lang>` wajib ikut berubah (sudah ditangani `useAppLocale`).
- Namespace per area fitur — milik eksklusif satu folder:
  | Namespace | Folder |
  |---|---|
  | `common` | `src/components/*` (aksi umum, save/sort/select/presence/activity/error boundary) |
  | `shell` | `src/features/layout`, CommandPalette |
  | `account` | auth, dashboard, profile, keys, teams |
  | `tracker` | board, issues, tests |
  | `project` | stack, schema, decisions, releases, overview, project |
  | `extras` | whiteboard, api, templates, admin, pricing, billing, public, docs |
- Key convention: `<folder>.<elemen>[.<sub>]` (`board.column.todo`, `issues.modal.deleteConfirmTitle`). Maks 3 level.
- **Nilai EN harus identik byte-per-byte dengan copy semula** (kapital, `…`, `—`, tanda baca) — test men-assert teks EN persis.
- Interpolasi `{{var}}`; dilarang concat string terjemahan. Plural: kunci `_one`/`_other` + param `count`.
- String dinamis dari server/user TIDAK diterjemahkan. Pesan error API tetap EN; hanya fallback statis client yang dilokalkan.
- Hook tidak boleh dipanggil di default parameter — pola: prop optional → `prop ?? t('key')` di body.
- Konstanta label di luar komponen: simpan sebagai i18n-key string, resolve saat render via `t(s.label)` (pola `TASK_SORT_SPECS` di BoardPage).
- Komponen class: pakai `import { i18n } from '../i18n'` + `i18n.t(...)`.
- String baru = wajib masuk **kedua** locale (`en/` dan `id/`) dalam commit yang sama; fallback EN menutup kunci ID yang hilang, tapi paritas adalah standar.
- Test default bahasa `en` (diset di `src/test/setup.ts`) — jangan mengubah locale global di dalam test tanpa mengembalikan ke `en`.

---

## 10. Server Code Standards

- Express routers are thin: validate (zod) → call service → respond. Business logic in service functions.
- All handlers async; central error middleware; never throw into Express default handler.
- SQL: parameterized queries only; transactions for multi-statement ops (e.g., import).
- Routes: kebab-case paths; consistent error codes (see §7).
- MCP tools: one file per tool in `server/src/modules/mcp/application/tools/`, each exporting `{ name, schema, handler }`. MCP auth: OAuth bearer (`server/src/modules/mcp/handlers/require-key.ts` + `modules/oauth/oauth.routes.ts`, scopes `mcp`/`mcp:read`/`mcp:write`); every tool DB access scoped by user via `modules/mcp/application/state-db.ts`. Server layout: modular monolith per bounded context — see ADR-041.

---

## 11. Commit & PR Standards (summary)

See [Git Workflow](git-workflow.md) for full detail:

- Conventional Commits: `feat(scope): description`, `fix(scope): ...`, `docs: ...`, `test: ...`, `refactor: ...`.
- One logical change per commit; PR ≤ ~400 lines unless justified.
- Every PR: `npm run lint && npm run typecheck && npm run test` green; docs updated when contract changes.

---

## 12. Definition of Done (code-level)

- [ ] TypeScript strict passes
- [ ] Lint + Prettier clean
- [ ] Tests written/passed for changed logic (reducer rules, zod schemas, auth)
- [ ] No new runtime dependencies (or ADR-recorded)
- [ ] Accessibility check on new components (keyboard + contrast)
- [ ] `npm run build` clean

---

*End of Coding Standards.*
