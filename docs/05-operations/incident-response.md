# Incident Response — DevHub

| Field | Value |
|---|---|
| **Document status** | Draft (Phase 0) |
| **Version** | 1.0 |
| **Owner** | Project Owner |
| **Last updated** | 2026-08-10 |
| **Related documents** | [Monitoring](monitoring.md) · [Backup & Recovery](backup-recovery.md) · [Security Design](../02-architecture/security-design.md) |

---

## 1. Scope & Model

Solo operation: the owner is on-call 24/7. This document defines **what counts as an incident, how to respond, and how to learn**. No pagers — alerting lands on the phone via ntfy (see [Monitoring](monitoring.md)).

---

## 2. Severity Matrix

| Sev | Definition | Example | Response time | Communication |
|---|---|---|---|---|
| **SEV-1** | Data loss or confirmed security breach | DB compromised, accounts leaked, ransomware | Immediate (< 1h) | Stop service → investigate → notify users |
| **SEV-2** | Service down / degraded for users | 503s, login broken, MCP down | < 4h | Fix → postmortem |
| **SEV-3** | Partial issue, non-blocking | Slow state save, chart rendering bug | < 24h | Fix in normal cycle |
| **SEV-4** | Cosmetic / no user impact | Typo, styling glitch | Next release | Normal backlog |

---

## 3. Incident Response Process

### 3.1 Detect & Triage (T-0)

1. Alert fires (ntfy) or user reports.
2. Confirm: check `/api/health`, provider dashboard, error logs.
3. Assign severity per matrix. **SEV-1/2 → stop work, start incident timer.**

### 3.2 Stabilize (T-0 → T-+1h)

| Step | Action |
|---|---|
| 1 | **Preserve evidence** (SEV-1): snapshot logs, DB dump before any action |
| 2 | Stop the bleeding: take the service down if data is at risk (`docker stop devhub`) |
| 3 | Quickest safe fix: rollback app (previous image) or restore DB ([Backup & Recovery §4](backup-recovery.md#4-restore-procedures)) |
| 4 | Verify recovery: health OK, login OK, data intact |

### 3.3 Diagnose (after stabilization)

- Root-cause from logs (structured JSON lines, grep by time window).
- For security incidents: check auth logs, rate-limit hits, MCP access logs (`mcp_keys.last_used_at`); rotate `JWT_SECRET`, revoke exposed MCP keys (`DELETE /api/keys/:id`), rotate DB credentials.
- Never jump to conclusions; write findings in the postmortem.

### 3.4 Resolve & Recover

- Apply permanent fix (code/hardening), test, release per [Deployment Runbook](deployment-runbook.md) §8.
- For SEV-1: after recovery, change every secret; audit data for tampering.

---

## 4. Communication

| Audience | What | How |
|---|---|---|
| Users (Phase 2+) | Service status, data-loss notifications | Status page + email if accounts exist |
| Self | Incident log | This document's log table |

**SEV-1 mandatory:** inform affected users within 24h (privacy obligations per [Privacy Policy](../06-compliance/privacy-policy.md)).

---

## 5. Postmortem Template

```
## Postmortem — <incident id>

- **Date / duration:** ...
- **Severity:** SEV-x
- **Summary (3 sentences max):** ...
- **Impact:** ...
- **Root cause:** ...
- **Timeline:** T-0 detection ... actions ...
- **What went well:** ...
- **What went wrong:** ...
- **Action items:** [ ] fix  [ ] test  [ ] docs  [ ] monitoring
- **Follow-up date:** ...
```

---

## 6. Incident Log

| ID | Date | Sev | Summary | Root cause | Actions |
|---|---|---|---|---|---|
| *(none yet — V1 not released)* | | | | | |

---

## 7. Prevention Checklist (monthly)

- [ ] Backup drill executed (quarterly at minimum)
- [ ] `npm audit` clean; patches applied
- [ ] Secrets rotated per schedule
- [ ] Rate-limit counters reviewed for abuse patterns
- [ ] Postmortems action items closed

---

*End of Incident Response.*
