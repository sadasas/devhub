---
title: Status
description: Is DevHub healthy? Health endpoint, what we monitor, and how to report problems.
---

## Service health

A public health check runs continuously. If the service is degraded, the app may still open from cache while the API recovers — give it a moment, then refresh.

## What we monitor

- Service and database health.
- Short operational logs for debugging (deleted after 14 days).
- Suspicious login attempts.
- Backup completion.
- Failed payment confirmations.

## Reporting a problem

- App misbehaving? Refresh first — data updates automatically, and a refresh re-syncs everything.
- Still broken? Email **support@devhub.nrawangbatin.my.id** with: what you did, what you expected, `order_id` for billing issues, and the time (WIB/UTC).
- Privacy/data requests: **privacy@devhub.nrawangbatin.my.id** — verification + action confirmation within 3×24 hours on business days.

## Maintenance windows

Backups run before any update. Material legal or pricing changes are announced on the service; continued use constitutes acceptance.
