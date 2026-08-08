# Git Workflow — DevHub

| Field | Value |
|---|---|
| **Document status** | Active |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-09 |

---

## 1. Branching Strategy: Trunk-Based (with short-lived branches)

Solo project: keep it simple, keep it fast.

| Rule | Value |
|---|---|
| Default branch | `main` (always deployable) |
| Long-lived branches | `main` only |
| Feature branches | `feat/<slug>` or `fix/<slug>`, branched from `main`, merged within days |
| Release tags | `vX.Y.Z` (SemVer) on `main` |
| Remote | Single origin (GitHub); local `devhub/` repo initialised at scaffold |

### Workflow

```
main ──●──●──●─────────────────────●── v0.1.0
        \        \                /
         feat/auth ●──●          /
                    \          /
                     \______/
```

1. `git checkout -b feat/add-issues main`
2. Small, focused commits (Conventional Commits).
3. `git pull --rebase main` before merge; resolve conflicts locally.
4. Merge with `--no-ff` (keeps history readable), or squash if the branch is a single logical change.
5. Delete the branch after merge.

---

## 2. Commit Convention (Conventional Commits)

```
<type>(<scope>): <description>

[optional body: why, not what]
```

| Type | Usage |
|---|---|
| `feat` | New feature/endpoint/entity |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Tests only |
| `refactor` | Behavior-preserving change |
| `chore` | Tooling, deps, build |
| `perf` | Performance improvement |
| `security` | Security fix (also apply the advisory process) |

**Scope examples:** `auth`, `state`, `board`, `schema`, `mcp`, `server`, `app`, `docs`, `deps`.

**Rules:**
- Imperative mood, ≤ 72 chars: `feat(board): add blockedBy dependency chip` ✓
- No trailing period; no emojis.
- Body explains *why* when not obvious, referencing ADR IDs for decisions (`Refs ADR-003`).
- **Never commit secrets** (see `.gitignore`; secrets only in `.env`).

Examples:

```
feat(auth): add register/login with httpOnly cookie
docs(adr): add ADR-010 public deploy decision
fix(state): reject dangling blockedBy refs on import
```

---

## 3. Pull Request Process

Even for a solo repo, PRs keep history reviewable. Recommended flow:

1. Push branch: `git push -u origin feat/add-issues`
2. Create PR against `main` with:
   - Title: `<type>(<scope>): <description>` (same as commit)
   - Body: summary, test checklist, screenshot if UI, link to ADR if architecture
3. Self-review against the [Code Review checklist](code-review.md).
4. CI (Phase 2): lint + typecheck + tests + build must pass.
5. Merge `--squash` (single logical change) or `--no-ff`.

**Emergency fix path (hotfix):** branch `fix/<slug>` from `main` → merge immediately → tag patch version.

---

## 4. Tagging & Releases

- Tags only on `main`: `v0.1.0`, `v0.1.1`, `v1.0.0`.
- Release notes = milestone changelog (in-app) + git tag message.
- Release procedure (with operations): see [Roadmap §7](../01-project/roadmap.md#7-release-management-process) and [Deployment Runbook](../05-operations/deployment-runbook.md).

---

## 5. .gitignore Essentials

```
node_modules/
dist/
.env
.env.*
!.env.example
*.log
.DS_Store
coverage/
```

---

## 6. Repository Hygiene

- `npm audit` before tagging a release; resolve high/critical.
- Keep `package-lock.json` in sync with `package.json` (commit both together).
- No large binaries in repo; assets in `public/` only when needed.
- Changelog discipline: release changelogs live in-app (Milestone entity) and in git tags — not duplicated in a repo CHANGELOG file.

---

*End of Git Workflow.*
