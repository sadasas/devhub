import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app, createProject, register, uniqueIp } from "./helpers.js";
import { resetDb } from "./setup.js";
import { emptyState } from "../src/modules/projects/domain/state.js";

const T_NORMAL = "11111111-1111-4111-8111-111111111111";
const T_ESCAPE = "22222222-2222-4222-8222-222222222222";
const T_NODATE = "33333333-3333-4333-8333-333333333333";
const T_DONE = "44444444-4444-4444-8444-444444444444";

const ESCAPE_TITLE = "Fix, review; launch \\ tomorrow\ntoday";

async function seedTasks(cookie: string, projectId: string): Promise<void> {
  const current = await request(app)
    .get(`/api/v1/projects/${projectId}/state`)
    .set("Cookie", cookie)
    .set("X-Forwarded-For", uniqueIp());
  expect(current.status).toBe(200);
  const res = await request(app)
    .put(`/api/v1/projects/${projectId}/state`)
    .set("Cookie", cookie)
    .set("X-Forwarded-For", uniqueIp())
    .send({
      state: {
        ...emptyState,
        tasks: [
          {
            id: T_NORMAL,
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
            title: "Ship v1",
            status: "todo",
            priority: "medium",
            labels: [],
            blockedBy: [],
            description: "",
            dueDate: "2026-09-20T00:00:00.000Z",
          },
          {
            id: T_ESCAPE,
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
            title: ESCAPE_TITLE,
            status: "inProgress",
            priority: "high",
            labels: [],
            blockedBy: [],
            description: "",
            dueDate: "2026-09-21",
          },
          {
            id: T_NODATE,
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
            title: "No date task",
            status: "todo",
            priority: "low",
            labels: [],
            blockedBy: [],
            description: "",
          },
          {
            id: T_DONE,
            createdAt: "2026-09-01T00:00:00.000Z",
            updatedAt: "2026-09-01T00:00:00.000Z",
            title: "Finished work",
            status: "done",
            priority: "medium",
            labels: [],
            blockedBy: [],
            description: "",
            dueDate: "2026-09-20T00:00:00.000Z",
          },
        ],
      },
      version: current.body.version,
    });
  expect(res.status).toBe(200);
}

describe("gcal playground dry-run (T6)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns mapped event JSON without calling Google", async () => {
    const cookie = await register("dry-run@test.dev");
    const projectId = await createProject(cookie, "Dry run");
    await seedTasks(cookie, projectId);

    const res = await request(app)
      .post("/api/v1/integrations/gcal/playground/dry-run")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp())
      .send({ projectId });
    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(projectId);
    // Kontrak mapping locked: tanpa tanggal di-skip, done ikut dengan prefix [Done].
    expect(res.body.count).toBe(3);
    expect(res.body.events).toHaveLength(3);
    const events = res.body.events as Array<{
      summary: string;
      description: string;
      start: { date: string };
      end: { date: string };
      extendedProperties: { private: { devhubTaskId: string; projectId: string } };
    }>;
    // Sort: start date, lalu title mentah, lalu id.
    expect(events[0]?.summary).toBe("[Done] Finished work");
    expect(events[0]?.start.date).toBe("2026-09-20");
    expect(events[0]?.end.date).toBe("2026-09-21");
    expect(events[1]?.summary).toBe("Ship v1");
    expect(events[1]?.start.date).toBe("2026-09-20");
    expect(events[1]?.end.date).toBe("2026-09-21");
    expect(events[1]?.extendedProperties.private.devhubTaskId).toBe(T_NORMAL);
    expect(events[1]?.extendedProperties.private.projectId).toBe(projectId);
    expect(events[1]?.description).toContain(`View task:`);
    expect(events[1]?.description).toContain(`/project/${projectId}?entity=tasks&id=${T_NORMAL}`);
    expect(events[2]?.summary).toBe(ESCAPE_TITLE);
    expect(events[2]?.start.date).toBe("2026-09-21");
  });

  it("validates the payload with zod", async () => {
    const cookie = await register("dry-run-bad@test.dev");
    const res = await request(app)
      .post("/api/v1/integrations/gcal/playground/dry-run")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp())
      .send({ projectId: "not-a-uuid" });
    expect(res.status).toBe(400);
  });
});
