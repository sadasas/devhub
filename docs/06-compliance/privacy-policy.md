# Privacy Policy — DevHub

**Effective date:** 2026-08-13
**Last updated:** 2026-08-09

---

## 1. Overview

DevHub ("the Service", "we", "our") provides project management tools for programming projects. This Privacy Policy explains what data we collect, why we collect it, how it is used, and the rights you have over it.

The Service is operated by the DevHub project owner ("the Operator"). This is a small hosted SaaS service; our philosophy is **minimal data collection and maximal data ownership by the user**.

---

## 2. Data We Collect

### 2.1 Account data (required to use the Service)

| Data | Purpose | Legal basis |
|---|---|---|
| Email address | Account identification, login, future account-recovery communication | Contract performance / legitimate interest |
| Password (hashed) | Authentication; stored as a bcrypt hash, never in plaintext | Contract performance / security |

### 2.2 Project data (provided by you)

All content you create inside the Service: projects, tasks, issues, test cases, tech stack entries, schema definitions, decisions, milestones, statistics, and any notes you enter. This data belongs to you and is stored to provide the Service to you.

### 2.3 Technical data (automatic)

| Data | Purpose |
|---|---|
| IP address (in server logs) | Security, rate limiting, abuse prevention |
| HTTP request metadata (path, status, duration) | Operation, debugging, performance |
| Session cookie | Keeping you logged in |

### 2.4 What we do NOT collect

- No third-party analytics or advertising cookies
- No tracking pixels, fingerprinting, or behavioral profiling
- No payment data (the Service has no billing)
- We do not sell or rent your data to anyone

---

## 3. How Data Is Used

- To operate, secure, and improve the Service.
- To respond to abuse or legal process (limited, see §7).
- We do **not** use your project data to train AI models, and we do not share it with AI providers. The optional MCP integration connects only at your configuration, using your API key.

---

## 4. Cookies & Sessions

| Cookie | Type | Purpose | Duration |
|---|---|---|---|
| `devhub_session` | Necessary (httpOnly, SameSite=Lax) | Authentication session | 24 hours, refreshed on login |

We use one functional cookie only. No advertising or tracking cookies. You may block cookies, but you will not be able to log in.

---

## 5. Data Storage & Security

- Data is stored on servers operated by the chosen managed hosting platform (location listed in the service status page).
- Passwords are hashed with bcrypt; sessions use signed JWTs; connections are encrypted with HTTPS.
- While we take reasonable technical and organizational measures, **no transmission or storage is 100% secure**; the Service is operated by a small team, not a large enterprise.

---

## 6. Data Retention & Deletion

| Data | Retention |
|---|---|
| Account + project data | Until you delete your account or request deletion |
| Server logs | 14 days, then automatically deleted |
| Backups | As documented in the operational runbook (rolling retention) |

**Your rights:**
- **Access/export:** export any project as JSON at any time (Project → Export).
- **Deletion:** delete projects at any time. Full account deletion: request via email/contact in §9; we will remove your account and all associated data within 30 days, including from backups on the next retention cycle where technically feasible.

---

## 7. Legal Disclosures

We will only disclose data to third parties if required by law or a binding legal request, and we will notify you where legally permitted.

---

## 8. Children

The Service is not directed at children under 16. If you believe a child has provided data, contact us and we will delete it.

---

## 9. Contact & Complaints

- Operator contact: *(owner email — to be set)*
- Data protection inquiries: same contact.
- If you reside in the EU/EEA you may lodge a complaint with your local supervisory authority; we will cooperate with any such process.

---

## 10. Changes to This Policy

We may update this policy; the "Last updated" date above will always reflect the current version. Material changes will be announced on the service. Continued use after changes constitutes acceptance.

---

*End of Privacy Policy.*
