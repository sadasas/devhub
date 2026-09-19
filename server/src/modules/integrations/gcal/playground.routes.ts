import { Router } from "express";
import { z } from "zod";
import { config } from "../../../config.js";
import { pool } from "../../../db/pool.js";
import { ApiError } from "../../../shared/errors.js";
import { parseOrThrow } from "../../../shared/db.js";
import { getBaseUrl } from "../../../shared/baseUrl.js";
import { logger } from "../../../shared/logger.js";
import { getUserId, requireAuth } from "../../auth/middleware/requireAuth.js";
import { getProjectWithRole } from "../../authorization/application/authz.js";
import { stateSchema } from "../../projects/domain/state.js";
import { taskToEvent } from "./application/mapping.js";

export const gcalPlaygroundRouter = Router();
gcalPlaygroundRouter.use(requireAuth);

const dryRunSchema = z.object({
  projectId: z.string().uuid(),
});

async function isPlatformAdmin(userId: string): Promise<boolean> {
  const result = await pool.query<{ role: string }>("SELECT role FROM users WHERE id = $1", [userId]);
  return result.rows[0]?.role === "admin";
}

// POST /api/v1/integrations/gcal/playground/dry-run — tanpa call Google.
// Memakai kontrak mapping locked (taskToEvent) yang sama dengan sync-service,
// sehingga output dry-run identik dengan body yang akan dikirim ke Google.
gcalPlaygroundRouter.post("/playground/dry-run", async (req, res) => {
  const userId = getUserId(req);
  const { projectId } = parseOrThrow(dryRunSchema, req.body, "Invalid playground payload");

  if (config.NODE_ENV === "production") {
    const admin = await isPlatformAdmin(userId);
    if (!admin) throw new ApiError(403, "FORBIDDEN", "Playground is disabled in production");
  }

  const row = await getProjectWithRole(userId, projectId);
  if (!row) throw new ApiError(404, "NOT_FOUND", "Project not found");

  const parsed = stateSchema.safeParse(row.data);
  if (!parsed.success) throw new ApiError(500, "INTERNAL", "Stored state is invalid");

  const taskUrlBase =
    config.APP_PUBLIC_URL.trim().length > 0
      ? config.APP_PUBLIC_URL.replace(/\/$/, "")
      : getBaseUrl(req);

  const events = parsed.data.tasks
    .map((task) => ({
      task,
      event: taskToEvent(
        {
          id: task.id,
          projectId,
          title: task.title,
          status: task.status,
          priority: task.priority,
          labels: task.labels,
          description: task.description,
          startDate: task.startDate ?? null,
          dueDate: task.dueDate ?? null,
        },
        { baseUrl: taskUrlBase },
      ),
    }))
    .filter((entry): entry is { task: (typeof parsed.data.tasks)[number]; event: NonNullable<ReturnType<typeof taskToEvent>> } =>
      entry.event !== null,
    )
    .sort((a, b) => {
      const date = a.event.start.date.localeCompare(b.event.start.date);
      if (date !== 0) return date;
      const title = a.task.title.localeCompare(b.task.title);
      if (title !== 0) return title;
      return a.task.id.localeCompare(b.task.id);
    })
    .map((entry) => entry.event);

  logger.info("gcal playground dry-run", { projectId, count: events.length });
  res.json({
    projectId,
    projectName: row.name,
    generatedAt: new Date().toISOString(),
    count: events.length,
    events,
  });
});
