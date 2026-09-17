import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { pool } from "../src/db/pool.js";
import { app, createProject, createTeam, inviteUser, register, uniqueIp } from "./helpers.js";
import { resetDb } from "./setup.js";
import { sealToken } from "../src/modules/integrations/gcal/infrastructure/token-vault.js";

async function userIdOf(cookie: string): Promise<string> {
  const me = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
  return (me.body as { id: string }).id;
}

describe("gcal project settings contract (T3/T4)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("status?projectId without connection returns combined shape, no leak", async () => {
    const cookie = await register("gcal-status-proj@test.dev");
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, "Status proj", teamId);

    const res = await request(app)
      .get(`/api/v1/integrations/gcal/status?projectId=${projectId}`)
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(res.body.expired).toBe(false);
    expect(res.body.email).toBeNull();
    expect(res.body.syncEnabled).toBe(false);
    expect(res.body.calendarId).toBeNull();
    expect(res.body.lastSyncAt).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain("refresh_token");
    expect(JSON.stringify(res.body)).not.toContain("access_token");
  });

  it("status?projectId for non-member is 404 (no existence leak beyond member gate)", async () => {
    const owner = await register("gcal-status-owner@test.dev");
    const stranger = await register("gcal-status-stranger@test.dev");
    const teamId = await createTeam(owner);
    const projectId = await createProject(owner, "Private proj", teamId);

    const res = await request(app)
      .get(`/api/v1/integrations/gcal/status?projectId=${projectId}`)
      .set("Cookie", stranger)
      .set("X-Forwarded-For", uniqueIp());
    expect(res.status).toBe(404);
  });

  it("settings enable without connection is 409 NEEDS_RECONNECT; disable works", async () => {
    const cookie = await register("gcal-settings-noconn@test.dev");
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, "Settings proj", teamId);

    const enable = await request(app)
      .post("/api/v1/integrations/gcal/settings")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp())
      .send({ projectId, syncEnabled: true });
    expect(enable.status).toBe(409);
    expect(enable.body.error.code).toBe("NEEDS_RECONNECT");

    const disable = await request(app)
      .post("/api/v1/integrations/gcal/settings")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp())
      .send({ projectId, syncEnabled: false });
    expect(disable.status).toBe(200);
    // Baris settings baru dibuat dengan calendar_id default 'primary' (039 reconcile);
    // enable berikutnya menimpa dengan id kalender Google asli via ensureCalendar.
    expect(disable.body).toEqual({ syncEnabled: false, calendarId: "primary" });
  });

  it("settings enable with connection auto-creates calendar and status reflects it", async () => {
    const cookie = await register("gcal-settings-ok@test.dev");
    const userId = await userIdOf(cookie);
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, "Settings ok", teamId);
    await pool.query(
      "INSERT INTO gcal_connections (user_id, refresh_token_enc, access_token_enc, expiry, scope, status) VALUES ($1,$2,$3,now()+interval '1 hour',$4,'connected')",
      [userId, sealToken("refresh-seed"), sealToken("access-seed"), "https://www.googleapis.com/auth/calendar.app.created"],
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "cal_abc123" }) }),
    );

    const enable = await request(app)
      .post("/api/v1/integrations/gcal/settings")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp())
      .send({ projectId, syncEnabled: true });
    expect(enable.status).toBe(200);
    expect(enable.body).toEqual({ syncEnabled: true, calendarId: "cal_abc123" });

    const status = await request(app)
      .get(`/api/v1/integrations/gcal/status?projectId=${projectId}`)
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    expect(status.status).toBe(200);
    expect(status.body.connected).toBe(true);
    expect(status.body.expired).toBe(false);
    expect(status.body.syncEnabled).toBe(true);
    expect(status.body.calendarId).toBe("cal_abc123");
  });

  it("viewer cannot toggle settings (fail-closed)", async () => {
    const owner = await register("gcal-settings-viewer-owner@test.dev");
    const viewer = await register("gcal-settings-viewer@test.dev");
    const teamId = await createTeam(owner);
    await inviteUser(owner, viewer, teamId, "viewer");
    const projectId = await createProject(owner, "Viewer proj", teamId);

    const res = await request(app)
      .post("/api/v1/integrations/gcal/settings")
      .set("Cookie", viewer)
      .set("X-Forwarded-For", uniqueIp())
      .send({ projectId, syncEnabled: true });
    expect([401, 403, 404]).toContain(res.status);
  });

  it("disconnect with projectId also disables project sync", async () => {
    const cookie = await register("gcal-disc-proj@test.dev");
    const userId = await userIdOf(cookie);
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, "Disc proj", teamId);
    await pool.query(
      "INSERT INTO gcal_connections (user_id, refresh_token_enc, access_token_enc, expiry, scope, status) VALUES ($1,$2,$3,now()+interval '1 hour',$4,'connected')",
      [userId, sealToken("refresh-seed"), sealToken("access-seed"), "https://www.googleapis.com/auth/calendar.app.created"],
    );
    await pool.query(
      "INSERT INTO gcal_project_settings (project_id, calendar_id, sync_enabled, owner_user_id) VALUES ($1,'cal_x',true,$2)",
      [projectId, userId],
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );

    const del = await request(app)
      .post("/api/v1/integrations/gcal/disconnect")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp())
      .send({ projectId });
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true });

    const settings = await pool.query<{ sync_enabled: boolean }>(
      "SELECT sync_enabled FROM gcal_project_settings WHERE project_id = $1",
      [projectId],
    );
    expect(settings.rows[0]?.sync_enabled).toBe(false);
  });

  it("enable with old-scope token (403 insufficientPermissions) asks reconnect", async () => {
    const cookie = await register("gcal-settings-scope@test.dev");
    const userId = await userIdOf(cookie);
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, "Settings scope", teamId);
    await pool.query(
      "INSERT INTO gcal_connections (user_id, refresh_token_enc, access_token_enc, expiry, scope, status) VALUES ($1,$2,$3,now()+interval '1 hour',$4,'connected')",
      [userId, sealToken("refresh-seed"), sealToken("access-seed"), "https://www.googleapis.com/auth/calendar.events"],
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 403,
            message: "Insufficient Permission",
            errors: [{ reason: "insufficientPermissions" }],
          },
        }),
      }),
    );

    const res = await request(app)
      .post("/api/v1/integrations/gcal/settings")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp())
      .send({ projectId, syncEnabled: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("NEEDS_RECONNECT");
    expect(res.body.error.message).toContain("additional permission");

    const conn = await pool.query<{ status: string }>(
      "SELECT status FROM gcal_connections WHERE user_id = $1",
      [userId],
    );
    expect(conn.rows[0]?.status).toBe("needs_reconnect");
  });

  it("enable with Calendar API disabled (403 accessNotConfigured) keeps connection, actionable message", async () => {
    const cookie = await register("gcal-settings-apioff@test.dev");
    const userId = await userIdOf(cookie);
    const teamId = await createTeam(cookie);
    const projectId = await createProject(cookie, "Settings apioff", teamId);
    await pool.query(
      "INSERT INTO gcal_connections (user_id, refresh_token_enc, access_token_enc, expiry, scope, status) VALUES ($1,$2,$3,now()+interval '1 hour',$4,'connected')",
      [userId, sealToken("refresh-seed"), sealToken("access-seed"), "https://www.googleapis.com/auth/calendar.app.created"],
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 403,
            message: "Calendar API has not been used in project X before or it is disabled.",
            errors: [{ reason: "accessNotConfigured" }],
          },
        }),
      }),
    );

    const res = await request(app)
      .post("/api/v1/integrations/gcal/settings")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp())
      .send({ projectId, syncEnabled: true });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("GCAL_CALENDAR_FAILED");
    expect(res.body.error.message).toContain("not enabled");

    const conn = await pool.query<{ status: string }>(
      "SELECT status FROM gcal_connections WHERE user_id = $1",
      [userId],
    );
    expect(conn.rows[0]?.status).toBe("connected");
  });
});
