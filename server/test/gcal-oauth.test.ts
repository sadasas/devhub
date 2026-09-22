import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { pool } from "../src/db/pool.js";
import { config } from "../src/config.js";
import { app, register, uniqueIp } from "./helpers.js";
import { resetDb } from "./setup.js";
import { sealToken } from "../src/modules/integrations/gcal/infrastructure/token-vault.js";

function gcalStateFromConnect(
  location: string,
  setCookie: string[] | undefined,
): { state: string; cookie: string } {
  const url = new URL(location);
  const state = url.searchParams.get("state");
  expect(state).toBeTruthy();
  const raw = (setCookie ?? []).find((c) => c.startsWith("devhub_oauth_state_gcal="));
  expect(raw).toBeDefined();
  const cookie = raw!.split(";")[0]!;
  // auth URL harus pakai scope calendar.app.created + offline + consent
  expect(url.hostname).toBe("accounts.google.com");
  expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/calendar.app.created");
  expect(url.searchParams.get("access_type")).toBe("offline");
  expect(url.searchParams.get("prompt")).toBe("consent");
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  return { state: state!, cookie };
}

describe("gcal oauth foundation (T1+T2)", () => {
  beforeEach(async () => {
    await resetDb();
    config.GOOGLE_CLIENT_ID = "test-google-client-id";
    config.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("connect redirects to Google with no-store + Vary:Cookie", async () => {
    const cookie = await register("gcal-connect@gmail.com");
    const res = await request(app)
      .get("/api/v1/integrations/gcal/connect")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    expect(res.status).toBe(302);
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(res.headers["vary"]).toContain("Cookie");
    const loc = res.headers["location"] as string;
    expect(loc).toContain("accounts.google.com");
  });

  it("callback rejects state mismatch (302 gcal_error=INVALID_STATE, no JSON)", async () => {
    const cookie = await register("gcal-mismatch@gmail.com");
    const connect = await request(app)
      .get("/api/v1/integrations/gcal/connect")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    expect(connect.status).toBe(302);
    const { cookie: stateCookie } = gcalStateFromConnect(
      connect.headers["location"] as string,
      connect.headers["set-cookie"] as unknown as string[] | undefined,
    );
    const res = await request(app)
      .get("/api/v1/integrations/gcal/callback?code=abc&state=wrong-state")
      .set("Cookie", `${cookie}; ${stateCookie}`)
      .set("X-Forwarded-For", uniqueIp());
    expect(res.status).toBe(302);
    expect(res.headers["location"] as string).toContain("gcal_error=INVALID_STATE");
    expect(res.headers["cache-control"]).toContain("no-store");
  });

  it("callback surfaces provider error as redirect (302 gcal_error=OAUTH_PROVIDER_ERROR)", async () => {
    const cookie = await register("gcal-provider-err@gmail.com");
    const connect = await request(app)
      .get("/api/v1/integrations/gcal/connect")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    const { state, cookie: stateCookie } = gcalStateFromConnect(
      connect.headers["location"] as string,
      connect.headers["set-cookie"] as unknown as string[] | undefined,
    );
    const res = await request(app)
      .get(`/api/v1/integrations/gcal/callback?error=access_denied&state=${state}`)
      .set("Cookie", `${cookie}; ${stateCookie}`)
      .set("X-Forwarded-For", uniqueIp());
    expect(res.status).toBe(302);
    expect(res.headers["location"] as string).toContain("gcal_error=OAUTH_PROVIDER_ERROR");
  });

  it("callback surfaces exchange failure without leaking tokens", async () => {
    const cookie = await register("gcal-exchange@gmail.com");
    const connect = await request(app)
      .get("/api/v1/integrations/gcal/connect")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    const { state, cookie: stateCookie } = gcalStateFromConnect(
      connect.headers["location"] as string,
      connect.headers["set-cookie"] as unknown as string[] | undefined,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "invalid_grant", error_description: "Bad code" }),
      }),
    );
    const res = await request(app)
      .get(`/api/v1/integrations/gcal/callback?code=bad-code&state=${state}`)
      .set("Cookie", `${cookie}; ${stateCookie}`)
      .set("X-Forwarded-For", uniqueIp());
    expect(res.status).toBe(302);
    expect(res.headers["location"] as string).toContain("gcal_error=OAUTH_EXCHANGE_FAILED");
    expect(res.headers["location"] as string).not.toContain("refresh");
    expect((res.headers["location"] as string).toLowerCase()).not.toContain("secret");
  });

  it("callback happy path stores encrypted tokens, status hides them", async () => {
    const cookie = await register("gcal-happy@gmail.com");
    const connect = await request(app)
      .get("/api/v1/integrations/gcal/connect")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    const { state, cookie: stateCookie } = gcalStateFromConnect(
      connect.headers["location"] as string,
      connect.headers["set-cookie"] as unknown as string[] | undefined,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "ya.test-access",
          refresh_token: "1//test-refresh",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/calendar.app.created",
        }),
      }),
    );
    const cb = await request(app)
      .get(`/api/v1/integrations/gcal/callback?code=good-code&state=${state}`)
      .set("Cookie", `${cookie}; ${stateCookie}`)
      .set("X-Forwarded-For", uniqueIp());
    // Callback kembali ke frontend (bukan JSON mentah) — default APP_PUBLIC_URL tes.
    expect(cb.status).toBe(302);
    const loc = cb.headers["location"] as string;
    expect(loc).toContain("gcal=connected");

    const status = await request(app)
      .get("/api/v1/integrations/gcal/status")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    expect(status.status).toBe(200);
    expect(status.body.connected).toBe(true);
    expect(status.body.scope).toBe("https://www.googleapis.com/auth/calendar.app.created");
    // tanpa bocor token
    expect(JSON.stringify(status.body)).not.toContain("ya.test-access");
    expect(JSON.stringify(status.body)).not.toContain("1//test-refresh");
    expect(JSON.stringify(status.body)).not.toContain("refresh_token_enc");
    expect(JSON.stringify(status.body)).not.toContain("access_token_enc");
  });

  it("callback honors validated returnTo and rejects open redirect", async () => {
    const cookie = await register("gcal-returnto@gmail.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "ya.rt-access",
          refresh_token: "1//rt-refresh",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/calendar.app.created",
        }),
      }),
    );

    // returnTo valid (origin localhost:5173 selalu di-allowlist) dipertahankan + flag sukses.
    const valid = "http://localhost:5173/project/11111111-1111-4111-8111-111111111111?view=calendar";
    const c1 = await request(app)
      .get(`/api/v1/integrations/gcal/connect?returnTo=${encodeURIComponent(valid)}`)
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    expect(c1.status).toBe(302);
    const s1 = gcalStateFromConnect(
      c1.headers["location"] as string,
      c1.headers["set-cookie"] as unknown as string[] | undefined,
    );
    const r1 = await request(app)
      .get(`/api/v1/integrations/gcal/callback?code=c1&state=${s1.state}`)
      .set("Cookie", `${cookie}; ${s1.cookie}`)
      .set("X-Forwarded-For", uniqueIp());
    expect(r1.status).toBe(302);
    const loc1 = r1.headers["location"] as string;
    expect(loc1.startsWith("http://localhost:5173/project/11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(loc1).toContain("gcal=connected");

    // returnTo jahat → fallback aman, tanpa bocor ke origin asing.
    const c2 = await request(app)
      .get("/api/v1/integrations/gcal/connect?returnTo=https%3A%2F%2Fevil.example%2Fsteal")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    const s2 = gcalStateFromConnect(
      c2.headers["location"] as string,
      c2.headers["set-cookie"] as unknown as string[] | undefined,
    );
    const r2 = await request(app)
      .get(`/api/v1/integrations/gcal/callback?code=c2&state=${s2.state}`)
      .set("Cookie", `${cookie}; ${s2.cookie}`)
      .set("X-Forwarded-For", uniqueIp());
    expect(r2.status).toBe(302);
    const loc2 = r2.headers["location"] as string;
    expect(loc2).not.toContain("evil.example");
    expect(loc2).toContain("gcal=connected");
  });

  it("status without connection returns disconnected, no token leak", async () => {
    const cookie = await register("gcal-noconn@gmail.com");
    const res = await request(app)
      .get("/api/v1/integrations/gcal/status")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(false);
    expect(JSON.stringify(res.body)).not.toContain("refresh_token");
    expect(JSON.stringify(res.body)).not.toContain("access_token");
  });

  it("disconnect removes stored tokens and status flips to false", async () => {
    const cookie = await register("gcal-disc@gmail.com");
    const me = await request(app).get("/api/v1/auth/me").set("Cookie", cookie);
    const userId = (me.body as { id: string }).id;
    await pool.query(
      "INSERT INTO gcal_connections (user_id, refresh_token_enc, access_token_enc, expiry, scope, status) VALUES ($1,$2,$3,now()+interval '1 hour',$4,'connected')",
      [userId, sealToken("refresh-seed"), sealToken("access-seed"), "https://www.googleapis.com/auth/calendar.app.created"],
    );
    // revoke best-effort jangan menggagalkan disconnect
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );
    const del = await request(app)
      .post("/api/v1/integrations/gcal/disconnect")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    expect(del.status).toBe(200);
    expect(del.body).toEqual({ ok: true });

    const after = await pool.query("SELECT count(*)::int AS n FROM gcal_connections WHERE user_id = $1", [
      userId,
    ]);
    expect(after.rows[0]?.n).toBe(0);

    const status = await request(app)
      .get("/api/v1/integrations/gcal/status")
      .set("Cookie", cookie)
      .set("X-Forwarded-For", uniqueIp());
    expect(status.body.connected).toBe(false);
  });
});
