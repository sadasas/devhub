---
title: Project Integrations
description: Connect Google Calendar and GitHub to a DevHub project — what each does, what it accesses, and how to manage it.
---

Project integrations connect a project to external apps. They are **off by default** and only run after an owner/admin connects them in **Project settings → Integrations**. The panel itself lists the features in use; this page is the full how-to.

## Google Calendar

### What it does

- Tasks with start or due dates become **all-day events** in a secondary calendar named `DevHub - <project>` in your Google account.
- Synced per task: title (`[Done]` prefix when done), dates, description, priority, labels, status, and a link back to the task. Tasks without dates are skipped.
- Edits and deletions sync automatically.
- The **sync toggle** pauses syncing without disconnecting.

### Permissions & data

- Least-privilege OAuth scope `calendar.app.created`: DevHub can only create and manage calendars and events it created — it cannot read your other calendars.
- Connection tokens are stored encrypted and refreshed automatically.

### Manage & troubleshooting

- **Disconnect** stops syncing; events already created stay in your calendar.
- **Expired** connections show a banner — use **Reconnect**.
- You can also revoke access via [Google account permissions](https://myaccount.google.com/permissions).
- If sync fails after a scope change, reconnect so the new token carries the current scope.

Details in the [Privacy Policy](/privacy/) and [Terms of Service](/terms/).

## GitHub

### What it does

- **Automatic linking:** pull requests, commits and branches link to tasks when they carry a task key.
- **DEV key formats** (in branch names, PR titles/bodies, commit messages): `DEV-XXXXXXXX` (8 hex, case-insensitive, Linear-style), a full task UUID, or an 8-hex short id.
- **Linkback comment:** the first PR that links tasks gets a `🔗 Linked to DevHub task(s)` comment.
- **Review & CI status** sync onto the linked tasks (badges on the task).
- **Status automation**, separately for “On PR opened” and “On PR merged”: `Auto` moves `todo → In Progress` on open and `→ Done` on merge; `Suggest` links plus shows a suggestion banner; `Off` only links.
- **Retry failed sync** replays the failed webhook queue.
- One repository per project.

### Permissions & data

- The GitHub App delivers webhook events (`push`, `pull_request`, reviews, checks) for the linked repo; DevHub reads PR/commit/check/review metadata via webhooks and the API.
- Access uses a short-lived installation token (~1 hour, refreshed on use) — your GitHub password is never stored.
- Stored: the repo mapping plus task links (repo, reference, title, status, CI/review state).

### Manage

- Only owners/admins can connect or change the mapping; editors have read access.
- **Connect:** press Connect → install the App on your GitHub organization → pick one repository → Connect repository.
- **Disconnect** removes the mapping; task links are kept as history. Uninstalling or suspending the App on GitHub also stops delivery.

Details in the [Privacy Policy](/privacy/) and [Terms of Service](/terms/).
