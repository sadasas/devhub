import { z } from "zod";

/**
 * Domain murni Google Calendar (ADR-041): hanya zod + konstanta + tipe.
 * Tanpa express/pg/fetch/config — semua I/O di application/infrastructure.
 */

/**
 * Scope OAuth GCal (least-privilege): boleh membuat kalender sekunder
 * ("DevHub - <project>") + CRUD event di kalender buatan app.
 * BUKAN `calendar.events` (tak bisa calendars.insert) dan BUKAN `calendar`
 * penuh (terlalu luas). Ganti scope = koneksi lama wajib Reconnect.
 */
export const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";

export const GCAL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GCAL_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GCAL_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export const gcalConnectionStatus = z.enum(["connected", "revoked", "error", "needs_reconnect"]);
export type GcalConnectionStatus = z.infer<typeof gcalConnectionStatus>;

export const gcalCallbackQuerySchema = z.object({
  code: z.string().min(1).max(2000),
  state: z.string().min(1).max(500),
});

export const gcalCallbackErrorQuerySchema = z.object({
  error: z.string().max(500).optional(),
  error_description: z.string().max(2000).optional(),
  code: z.string().max(2000).optional(),
  state: z.string().max(500).optional(),
});

export type GcalCallbackQuery = z.infer<typeof gcalCallbackQuerySchema>;

/** Input task minimal untuk mapping — mirror taskSchema (tanpa import lintas modul). */
export const gcalTaskInputSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(300),
  status: z.enum(["todo", "inProgress", "review", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  labels: z.array(z.string().max(50)).max(20).default([]),
  description: z.string().max(10_000).default(""),
  startDate: z.string().max(100).nullable().optional(),
  dueDate: z.string().max(100).nullable().optional(),
});

export type GcalTaskInput = z.infer<typeof gcalTaskInputSchema>;

/** Google Calendar event (all-day) yang dikirim ke Calendar API. */
export const gcalEventSchema = z.object({
  summary: z.string().min(1).max(500),
  description: z.string().max(10_000),
  start: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  end: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  extendedProperties: z.object({
    private: z.object({
      devhubTaskId: z.string().uuid(),
      projectId: z.string().uuid(),
    }),
  }),
});

export type GcalEvent = z.infer<typeof gcalEventSchema>;

export const gcalStatusResponseSchema = z.object({
  connected: z.boolean(),
  status: gcalConnectionStatus.or(z.string()),
  scope: z.string().nullable(),
  expiry: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export type GcalStatusResponse = z.infer<typeof gcalStatusResponseSchema>;

export const gcalOutboxOp = z.enum(["upsert", "delete"]);
export type GcalOutboxOp = z.infer<typeof gcalOutboxOp>;
