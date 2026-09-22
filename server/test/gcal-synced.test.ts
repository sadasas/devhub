import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { pool } from "../src/db/pool.js";
import { app, createProject, createTeam, register, uniqueIp } from "./helpers.js";
import { resetDb } from "./setup.js";

describe("gcal synced task list (board markers)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns empty list when nothing is mapped", async () => {
    const cookie = await register("gcal-synced-empty@test.dev");
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, "Synced empty", teamId);

    const res = await request(app)
      .get(`/api/v1/integrations/gcal/synced?projectId=${projectId}`)
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ taskIds: [] });
  });

  it("returns mapped task ids for members", async () => {
    const cookie = await register("gcal-synced-list@test.dev");
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, "Synced list", teamId);

    await pool.query(
      "INSERT INTO gcal_event_map (project_id, task_id, event_id, calendar_id) VALUES ($1,$2,$3,$4), ($1,$5,$6,$4)",
      [projectId, "11111111-1111-4111-8111-111111111111", "evt_1", "primary", "22222222-2222-4222-8222-222222222222", "evt_2"],
    );

    const res = await request(app)
      .get(`/api/v1/integrations/gcal/synced?projectId=${projectId}`)
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    expect(res.status).toBe(200);
    expect(new Set(res.body.taskIds)).toEqual(
      new Set(["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"]),
    );
  });

  it("rejects non-members with 404 and missing projectId with 400", async () => {
    const owner = await register("gcal-synced-owner@test.dev");
    const stranger = await register("gcal-synced-stranger@test.dev");
    const teamId = await createTeam(owner);
    const projectId = await createProject(owner, "Private synced", teamId);

    const forbidden = await request(app)
      .get(`/api/v1/integrations/gcal/synced?projectId=${projectId}`)
      .set("Cookie", stranger)
      .set("X-Forwarded-For", uniqueIp());
    expect(forbidden.status).toBe(404);

    const bad = await request(app)
      .get("/api/v1/integrations/gcal/synced")
      .set("Cookie", owner)
      .set("X-Forwarded-For", uniqueIp());
    expect(bad.status).toBe(400);
  });
});
