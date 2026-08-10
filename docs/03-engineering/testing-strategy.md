# Testing Strategy — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-10 |

---

## 1. Test Pyramid

```
        ▲  E2E (Phase 2, Playwright)        few, critical paths
       / \
      /   \  Integration (supertest + test Postgres)   ~15-25
     /     \
    /       \  Unit (vitest)               many, fast
   /__________\
```

| Layer | Tool | Runtime | Coverage focus |
|---|---|---|---|
| Unit | vitest | ms | zod schemas, reducers, auth helpers, state rules |
| Integration | vitest + supertest | s | API endpoints, auth flow, MCP contracts |
| E2E | Playwright (Phase 2) | min | register → create project → kanban → export |

**Targets:** unit ≥ 80% on business logic files (reducers, schema, auth); integration covers all endpoints; E2E covers the 5 critical journeys.

---

## 2. Unit Tests

Location: colocated `*.test.ts` beside sources (`app/src/features/board/board.reducer.test.ts`).

### 2.1 What to unit test (priority order)

| Area | Examples |
|---|---|
| State integrity rules | `blockedBy` must reference existing tasks; deleting task cleans refs; deleting table cascades relations |
| Reducers | every action: create/update/delete/reorder/status-change; `updatedAt` refreshed |
| zod schemas | valid payload passes; unknown keys, wrong types, dangling refs rejected |
| Auth helpers | password hash/verify (bcrypt), JWT sign/verify/expiry |
| Utils | id generation, ISO date formatting, export/import round-trip |

### 2.2 What NOT to unit test

- Pure presentational components (covered by design-system conventions + E2E)
- Third-party libraries

---

## 3. Integration Tests (server)

Location: `server/test/`.

| Suite | Cases |
|---|---|
| `auth.test.ts` | register → login → me → logout; wrong password; duplicate email; rate-limit triggers 429 |
| `projects.test.ts` | CRUD; cross-user isolation (user B cannot access user A's project); 401 without cookie |
| `keys.test.ts` | create → list → revoke; raw key returned once; 401 without cookie; revoked key rejected on `/mcp` |
| `state.test.ts` | GET empty state; PUT valid state; PUT invalid → 400; oversize body → 413 |
| `export-import.test.ts` | export → import round-trip preserves data |
| `mcp.test.ts` | no key → 401; invalid key → 401; revoked key → 401; user A's key cannot read/write user B's project; valid key + tool call → result; invalid args → 400 |

**Database:** dedicated test Postgres (docker compose `devhub-test`), migrations run per suite, truncate between tests. `DATABASE_URL_TEST` env.

**Test commands:**

```bash
npm run test          # unit + integration
npm run test:unit     # unit only
npm run test:server   # integration only
```

---

## 4. E2E Tests (Phase 2)

Playwright against a locally built app + test DB:

1. Register → create project → create 3 tasks → drag one to Done
2. Export JSON → reimport → data identical
3. Ctrl+K palette → navigate to Schema tab
4. Create issue → link task → board shows dependency
5. MCP: call `create_task` via HTTP → UI (polling) shows it

---

## 5. Manual Verification (V1 release)

Per [PRD §5 Release Criteria](../01-project/prd.md#5-release-criteria-definition-of-done-for-v1):

- [ ] All 8 tabs manually exercised
- [ ] Export → wipe → import preserves everything
- [ ] MCP full agent loop (plan → create → update → read) verified
- [ ] Keyboard: all primary actions; Ctrl+K
- [ ] Contrast spot-checks (AA) on forms/CTAs
- [ ] `npm run build` clean

---

## 6. Test Data & Fixtures

- `server/test/fixtures/state.valid.json` — a realistic full state (all 10 entities).
- `state.invalid-*.json` — tampered payloads for zod negative tests.
- Faker-style generators unnecessary; hand-written fixtures suffice at this scale.

---

## 7. CI (Phase 2)

GitHub Actions on push/PR: `lint → typecheck → test (with postgres service container) → build`. Upload Playwright traces on E2E failure.

---

*End of Testing Strategy.*
