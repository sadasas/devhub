# Privacy Policy — DevHub

**Effective date:** 2026-08-13
**Last updated:** 2026-09-24
**Version:** 2026-09-24-v5

---

## 1. Overview

DevHub ("the Service", "we", "our") provides project management tools for programming projects. This Privacy Policy explains what data we collect, why we collect it, how it is used, and the rights you have over it.

The Service is operated by the DevHub project owner ("the Operator"), domiciled in Indonesia. Our philosophy is **minimal data collection and maximal data ownership by the user**.

---

## 2. Data We Collect

### 2.1 Account data (required to use the Service)

| Data | Purpose | Legal basis |
|---|---|---|
| Email address | Account identification, login, future account-recovery communication | Contract performance / legitimate interest |
| Password (hashed) | Authentication; never stored in plaintext | Contract performance / security |
| Display name, bio, avatar (optional) | Profile personalization | Consent (provided by you) |
| Social login linkage (Google/GitHub account, verified email) | Social login, only when you choose it | Consent / contract performance |

### 2.2 Project data (provided by you)

All content you create inside the Service: projects, tasks, issues, test cases, tech stack entries, schema definitions, decisions, milestones, statistics, and any notes you enter. This data belongs to you and is stored to provide the Service to you.

**File attachments (premium workspaces):** files you upload to a task or issue are stored in managed DevHub object storage (byte content), while the app database keeps only metadata (file name, type, size, link reference). Each package has a storage quota set by the admin (the Free package has no upload quota — links only). Deleting an attachment, its task/issue, or its project removes the stored file; JSON export carries the attachment list (metadata), not the file bytes.

**Storage sub-processor — Supabase + TUS resumable:** attachment bytes live in a **Supabase**-hosted object-storage bucket (`devhub-attachments`), acting as our sub-processor for file storage. Uploads use the TUS resumable protocol: your browser talks directly to Supabase (`https://<ref>.storage.supabase.co/storage/v1/upload/resumable`) with a short-lived presigned token (`x-signature`, 2 hours), with a single-request signed-URL PUT as fallback — your Supabase service key never leaves our server and is never exposed to browsers. What Supabase processes per upload: the file bytes, file name/MIME/size, and short-lived upload/download tokens. Supabase never receives your password, project content outside the uploaded file, or payment data. Their terms and privacy policy apply to their processing.

### 2.3 Billing data (Pakasir)

Payments are processed by **Pakasir** (payment processor for QRIS/virtual-account). What we store, per workspace purchase:

- **Order record:** order ID, amount (IDR), payment status (`pending`/`completed`/`cancelled`), package name, duration, and timestamps. Prices and durations shown at checkout are final for that order.
- **Payment verification log:** the verification result for each order, without sensitive data (login tokens, cookies, and API keys are never stored).
- **Your plan:** current package and expiry date. Renewal is manual — each successful payment extends the expiry from the later of the old expiry or the payment time, so paying early never wastes days.

What we explicitly **do not store**: virtual-account numbers, QR payloads / QR images, card numbers, or any payment-instrument credentials. Those appear only on the Pakasir hosted payment page (`app.pakasir.com`) and never touch our systems. Cancel a pending order any time from the Billing page.

### 2.4 Transactional email (Resend)

Account emails (registration verification, password reset, team invitations) are sent by **Resend** (`resend.com`) as our sub-processor. What Resend processes per email:

- **Recipient address, subject, and message body** (e.g. your team name in an invitation, the verification/reset link).
- **Delivery metadata:** send/bounce/complaint events, retained 30 days (Resend Free plan).

What we store ourselves: the outbox record (`mail_outbox`: recipient, template, send status, attempts) for retries and debugging — never email credentials. Resend never receives your password, project content, or payment data. Their terms and privacy policy apply to their processing.

Prices may change over time; the amount charged is the amount shown and recorded at checkout. A retired package keeps working until its expiry date but cannot be purchased again.

### 2.5 Technical data (automatic)

| Data | Purpose |
|---|---|
| IP address (in server logs) | Security, abuse prevention |
| Basic request info (page visited, success/error, load time) | Operation, debugging, performance |
| Session cookie | Keeping you logged in |

### 2.6 What we do NOT collect by default

- No advertising cookies, tracking pixels, fingerprinting, or behavioral profiling.
- No sale or rental of your data to anyone.
- Google Analytics cookies (`_ga` / `_ga_XXXX`) are **non-necessary** and are only set after your consent via footer **Pengaturan Cookie** (see §4).

### 2.7 Project integrations (optional, configured by you)

Project integrations are off by default and only run after an owner/admin connects them in Project settings → Integrations.

- **Google Calendar sync.** When connected, tasks with start or due dates become all-day events in a secondary calendar named “DevHub - \<project\>” in your Google account; edits and deletions sync automatically. What Google receives per synced task: title, dates, description, priority, labels, status, and a link back to the task. DevHub requests the least-privilege scope `calendar.app.created`: it can only create and manage calendars and events it created — it cannot read your other calendars. Connection tokens are stored encrypted and refreshed automatically. Disconnect in Project settings (or revoke via Google account permissions) stops syncing; events already created stay in your calendar. Google's handling of that data follows [Google's API policies](https://developers.google.com/terms/api-services-user-data-policy).
- **GitHub App.** When connected, the GitHub App delivers webhook events (push, pull requests, reviews, checks) for the linked repository; DevHub attaches links (repo, PR/commit/branch reference, title, status, CI/review state) to matching tasks and posts a linkback comment when a PR first links tasks. Access uses a short-lived installation token (~1 hour, refreshed on use) — your GitHub password is never stored. Disconnecting removes the repo mapping; task links are kept as history. Uninstalling the App on GitHub also stops delivery. GitHub's handling of that data follows [GitHub's policies](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement).

---

## 3. How Data Is Used

- To operate, secure, and improve the Service.
- To process workspace subscriptions (create a pending order, confirm it with Pakasir, activate your plan, keep the verification log).
- To respond to abuse or legal process (limited, see §7).
- We do **not** use your project data to train AI models, and we do not share it with AI providers. The optional MCP integration connects only when you configure it, using your own authorization.

---

## 4. Cookies & Sessions

| Cookie | Category | Purpose | Duration |
|---|---|---|---|
| `devhub_session` | Necessary | Keeps you logged in (secure, HttpOnly) | 24 hours, refreshed on login |
| `devhub_oauth_state_<provider>` | Necessary | Short-lived login helper for Google/GitHub sign-in | 10 minutes |
| `_ga`, `_ga_XXXX` | Non-necessary (analytics, Google) | Only set after consent | Up to 2 years |

We use one necessary login cookie plus a short-lived social-login helper. Analytics cookies are opt-in only. You may block cookies, but you will not be able to log in. To withdraw consent for non-necessary cookies, open the footer **Pengaturan Cookie** (Cookie Settings) and toggle analytics off — already-set `_ga` cookies stop being used and age out; you can also delete them in your browser.

---

## 5. Data Storage & International Transfer

- The Service runs on managed cloud infrastructure (database, app hosting, and CDN). Depending on provider regions, your data may be stored or processed **outside Indonesia** for hosting, backup, and content delivery.
- Passwords are stored hashed (never plaintext); connections are encrypted with HTTPS.
- While we take reasonable technical and organizational measures, **no transmission or storage is 100% secure**; the Service is operated by a small team, not a large enterprise.

---

## 6. Data Retention & Deletion

| Data | Retention |
|---|---|
| Account + project data | Until you delete your account or request deletion |
| Billing records | Retained as financial/operational records while your account exists and as required by Indonesian law; anonymized or deleted on verified account-deletion request where legally permitted |
| Server logs | 14 days, then automatically deleted |
| Integration tokens & mappings | Removed on disconnect (events/links history as described in §2.7) |
| Attachment bytes (Supabase bucket) vs metadata (app DB) | Bytes: deleted together with their attachment/task/issue/project (best-effort `removeObject`); metadata rows follow the account/project deletion below. JSON export carries metadata only — bytes cannot be reconstructed from an export |
| Backups | Rolling retention (older copies are replaced on a schedule) |

**Your rights (handled within 3×24 hours for verification + action confirmation):**
- **Access/export:** export any project as JSON at any time (Project → Export); request a copy of your account data via email.
- **Correction:** fix profile data in-app (Profile) or request correction via email.
- **Deletion:** delete projects at any time. Full account deletion: request via `privacy@devhub.nrawangbatin.my.id`; we will remove your account and all associated data within 30 days, including from backups on the next retention cycle where technically feasible.
- **Withdraw consent:** revoke analytics consent via footer **Pengaturan Cookie**; revoke social/OAuth app access via Profile → Authorized Apps; revoke agent access tokens to stop AI-agent access immediately.

After a subscription expires, the workspace reverts to Free limits. For **7 days after expiry (grace period)** over-quota content stays accessible **read-only** (no new projects/members beyond the Free quota); renewing stacks from the later of now or the old expiry, so you never lose paid days. Moving to a smaller package takes effect at expiry; upgrades and same-package renewals apply instantly.

---

## 7. Legal Disclosures

We will only disclose data to third parties if required by law or a binding legal request under Indonesian law, and we will notify you where legally permitted. Payment confirmation with Pakasir (`app.pakasir.com`) covers only the order ID and amount — never your project content. Transactional email via Resend (§2.4) covers only the recipient, subject, body, and delivery metadata of account emails — never passwords or project content. File bytes + upload tokens via Supabase (§2.2) cover only the uploaded file and its metadata — never passwords, unrelated project content, or payment data. Project integrations (§2.7) send only the task/repo metadata described there to Google/GitHub — never passwords or unrelated project content.

---

## 8. Children

The Service is not directed at children under 16. If you believe a child has provided data, contact us and we will delete it.

---

## 9. Contact & Complaints

- General and billing support: **support@devhub.nrawangbatin.my.id**
- Data protection / privacy inquiries: **privacy@devhub.nrawangbatin.my.id**
- Response target: verification and action confirmation within **3×24 hours** on business days.
- Governing law is the law of **Indonesia**. If you reside in the EU/EEA you may additionally lodge a complaint with your local supervisory authority; we will cooperate with any such process.

---

## 10. Changes to This Policy

We may update this policy; the "Last updated" date and "Version" above always reflect the current version. Material changes will be announced on the service. Continued use after changes constitutes acceptance.

---

*End of Privacy Policy.*
