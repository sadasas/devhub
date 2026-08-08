# Code Review — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-09 |

---

## 1. Purpose

Even as a solo project, every merge goes through a structured self-review pass. This document defines the checklist and Definition of Done so that "done" means the same thing every time.

---

## 2. Review Scope

Every PR or merge to `main` is reviewed against:

1. **Correctness** — does it do what the story says?
2. **Security** — [Security Design checklist](../02-architecture/security-design.md#11-security-test-plan-v1-release) where applicable.
3. **Consistency** — [Coding Standards](coding-standards.md).
4. **Contract sync** — did API/zod/types change together?
5. **Docs** — README/API/ADR updated if behavior changed?

---

## 3. Self-Review Checklist

### 3.1 Functionality
- [ ] Acceptance criteria of the user story/PRD item met
- [ ] Edge cases handled: empty state, deletion, dangling references (`blockedBy`, relations)
- [ ] Error paths handled (server errors surfaced, not silent)
- [ ] Export/import unaffected or updated

### 3.2 Security (when touching auth/state/MCP)
- [ ] zod validation present on all new inputs
- [ ] Owner-scoping on all new queries
- [ ] No secrets/tokens logged or committed
- [ ] Rate-limit/body-size considerations applied
- [ ] Cookie flags unchanged/verified (HttpOnly, SameSite, Secure)

### 3.3 Code quality
- [ ] TypeScript strict passes
- [ ] No `any`, no `@ts-ignore` without comment and justification
- [ ] Immutability respected; reducer is sole mutator
- [ ] No dead code; no commented-out blocks
- [ ] Functions small; single responsibility
- [ ] No new dependencies without ADR/scope note

### 3.4 UI/UX (when touching UI)
- [ ] Uses design-system primitives + tokens (no raw hex/spacing)
- [ ] Keyboard operable; focus visible
- [ ] Contrast AA; `prefers-reduced-motion` honored
- [ ] Loading (skeleton), empty, and error states present
- [ ] Mono font for numbers/IDs
- [ ] Dark theme consistent (it is the only theme)

### 3.5 Tests & build
- [ ] Unit tests for new reducer/zod/auth logic
- [ ] `npm run lint && npm run typecheck && npm run test && npm run build` green

---

## 4. Definition of Done (merge criteria)

All 3.x checklists pass **and**:

- [ ] Commit messages follow Conventional Commits
- [ ] Docs updated if contract/behavior changed (types.ts ↔ zod sync)
- [ ] ADR added if an architectural decision changed
- [ ] PR body explains what/why for future self

---

## 5. Review Workflow (solo adaptation)

1. Write the change in a `feat/` branch.
2. Sleep on it (at least overnight for anything > 200 lines).
3. Re-read diff fresh; run the checklists.
4. Merge; delete branch; tag if release-worthy.

> "If you can't review your own diff the next day, you can't ship it."

---

*End of Code Review.*
