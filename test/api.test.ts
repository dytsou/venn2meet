import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { FakeD1Database } from "./support/fake-d1";
import { resetRateLimitsForTest } from "../src/middleware/rate-limit";

type TestEnv = {
  DB: D1Database;
  SESSION_SECRET: string;
  CREATE_RATE_LIMIT?: number;
  JOIN_RATE_LIMIT?: number;
  WRITE_RATE_LIMIT?: number;
};

function buildEnv(overrides: Partial<TestEnv> = {}): TestEnv {
  resetRateLimitsForTest();

  return {
    DB: new FakeD1Database() as unknown as D1Database,
    SESSION_SECRET: "test-secret",
    CREATE_RATE_LIMIT: 10,
    JOIN_RATE_LIMIT: 50,
    WRITE_RATE_LIMIT: 30,
    ...overrides
  };
}

async function apiRequest(args: {
  env: TestEnv;
  path: string;
  method?: string;
  body?: unknown;
  cookie?: string;
}) {
  const headers = new Headers();
  if (args.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (args.cookie) {
    headers.set("cookie", args.cookie);
  }

  const request = new Request(`http://localhost${args.path}`, {
    method: args.method ?? "GET",
    headers,
    body: args.body === undefined ? undefined : JSON.stringify(args.body)
  });

  return app.request(request, undefined, args.env as never);
}

function parseCookie(response: Response): string | null {
  const raw = response.headers.get("set-cookie");
  if (!raw) {
    return null;
  }
  return raw.split(";")[0] ?? null;
}

async function createEvent(env: TestEnv): Promise<{ token: string; cookie: string }> {
  const response = await apiRequest({
    env,
    path: "/api/events",
    method: "POST",
    body: {
      title: "Team Sync",
      timezone: "UTC",
      startIso: "2026-06-01T00:00:00.000Z",
      endIso: "2026-06-02T00:00:00.000Z",
      granularityMinutes: 60
    }
  });

  expect(response.status).toBe(201);
  const body = (await response.json()) as { token: string; url: string; slotCount: number };
  const cookie = parseCookie(response);
  expect(cookie).toBeTruthy();
  expect(body.slotCount).toBe(24);

  return { token: body.token, cookie: cookie as string };
}

describe("api", () => {
  it("creates an event and returns initial aggregate-only grid", async () => {
    const env = buildEnv();
    const { token, cookie } = await createEvent(env);

    const gridResponse = await apiRequest({
      env,
      path: `/api/events/${token}/grid`,
      cookie
    });

    expect(gridResponse.status).toBe(200);
    await expect(gridResponse.json()).resolves.toEqual({
      n: 0,
      slots: [],
      mine: []
    });
  });

  it("never returns participant attribution fields from grid", async () => {
    const env = buildEnv();
    const { token, cookie } = await createEvent(env);

    const gridResponse = await apiRequest({
      env,
      path: `/api/events/${token}/grid`,
      cookie
    });

    const payload = (await gridResponse.json()) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["mine", "n", "slots"]);
    expect(Array.isArray(payload.slots)).toBe(true);
    for (const slot of payload.slots as Array<Record<string, unknown>>) {
      expect(Object.keys(slot).sort()).toEqual(["count", "i"]);
    }
    expect(payload).not.toHaveProperty("participants");
    expect(JSON.stringify(payload)).not.toContain("participant_id");
    expect(JSON.stringify(payload)).not.toContain("participantId");

    const write = await apiRequest({
      env,
      path: `/api/events/${token}/availability`,
      method: "PATCH",
      cookie,
      body: { select: [1], deselect: [] }
    });
    expect(write.status).toBe(200);

    const populatedGridResponse = await apiRequest({
      env,
      path: `/api/events/${token}/grid`,
      cookie
    });
    const populatedPayload = (await populatedGridResponse.json()) as Record<string, unknown>;
    expect(Object.keys(populatedPayload).sort()).toEqual(["mine", "n", "slots"]);

    for (const slot of populatedPayload.slots as Array<Record<string, unknown>>) {
      expect(Object.keys(slot).sort()).toEqual(["count", "i"]);
    }
  });

  it("keeps event-specific session cookie continuity across events", async () => {
    const env = buildEnv();

    const eventA = await createEvent(env);
    const joinA = await apiRequest({
      env,
      path: `/api/events/${eventA.token}/grid`,
      cookie: eventA.cookie
    });
    expect(joinA.status).toBe(200);

    const createB = await apiRequest({
      env,
      path: "/api/events",
      method: "POST",
      cookie: eventA.cookie,
      body: {
        title: "Team Sync B",
        timezone: "UTC",
        startIso: "2026-06-03T00:00:00.000Z",
        endIso: "2026-06-04T00:00:00.000Z",
        granularityMinutes: 60
      }
    });
    expect(createB.status).toBe(201);
    const eventB = (await createB.json()) as { token: string };

    const cookieAValue = eventA.cookie.split("=")[1];
    const cookieB = parseCookie(createB);
    expect(cookieB).toBeTruthy();
    const cookieBValue = (cookieB as string).split("=")[1];

    const combinedCookie = `${eventA.cookie}; ${cookieB as string}`;

    const writeA = await apiRequest({
      env,
      path: `/api/events/${eventA.token}/availability`,
      method: "PATCH",
      cookie: combinedCookie,
      body: { select: [2], deselect: [] }
    });
    expect(writeA.status).toBe(200);

    const writeB = await apiRequest({
      env,
      path: `/api/events/${eventB.token}/availability`,
      method: "PATCH",
      cookie: combinedCookie,
      body: { select: [3], deselect: [] }
    });
    expect(writeB.status).toBe(200);

    const backToA = await apiRequest({
      env,
      path: `/api/events/${eventA.token}/grid`,
      cookie: combinedCookie
    });
    expect(backToA.status).toBe(200);
    const backToAPayload = (await backToA.json()) as { n: number; mine: number[] };
    expect(backToAPayload.n).toBe(1);
    expect(backToAPayload.mine).toEqual([2]);

    const backToB = await apiRequest({
      env,
      path: `/api/events/${eventB.token}/grid`,
      cookie: combinedCookie
    });
    expect(backToB.status).toBe(200);
    const backToBPayload = (await backToB.json()) as { n: number; mine: number[] };
    expect(backToBPayload.n).toBe(1);
    expect(backToBPayload.mine).toEqual([3]);

    expect(cookieAValue).toBeTruthy();
    expect(cookieBValue).toBeTruthy();
    expect(cookieAValue).not.toBe(cookieBValue);
  });

  it("returns 404 for unknown event token", async () => {
    const env = buildEnv();
    const response = await apiRequest({
      env,
      path: "/api/events/not-real-token/grid"
    });

    expect(response.status).toBe(404);
  });

  it("returns 401 on availability write without valid session", async () => {
    const env = buildEnv();
    const { token } = await createEvent(env);

    const response = await apiRequest({
      env,
      path: `/api/events/${token}/availability`,
      method: "PATCH",
      body: {
        select: [1],
        deselect: []
      }
    });

    expect(response.status).toBe(401);
  });

  it("returns 429 when join rate limit is exceeded", async () => {
    const env = buildEnv({ JOIN_RATE_LIMIT: 1 });
    const { token } = await createEvent(env);

    const first = await apiRequest({
      env,
      path: `/api/events/${token}/grid`
    });
    expect(first.status).toBe(200);

    const second = await apiRequest({
      env,
      path: `/api/events/${token}/grid`
    });
    expect(second.status).toBe(429);
  });

  it("reflects multiple sessions in counts without revealing identity", async () => {
    const env = buildEnv();
    const { token, cookie: cookieA } = await createEvent(env);

    const writeA = await apiRequest({
      env,
      path: `/api/events/${token}/availability`,
      method: "PATCH",
      cookie: cookieA,
      body: { select: [1], deselect: [] }
    });
    expect(writeA.status).toBe(200);

    const joinB = await apiRequest({
      env,
      path: `/api/events/${token}/grid`
    });
    expect(joinB.status).toBe(200);
    const cookieB = parseCookie(joinB);
    expect(cookieB).toBeTruthy();

    const writeB = await apiRequest({
      env,
      path: `/api/events/${token}/availability`,
      method: "PATCH",
      cookie: cookieB as string,
      body: { select: [1], deselect: [] }
    });
    expect(writeB.status).toBe(200);

    const gridA = await apiRequest({
      env,
      path: `/api/events/${token}/grid`,
      cookie: cookieA
    });

    const payload = (await gridA.json()) as {
      n: number;
      slots: Array<{ i: number; count: number }>;
      mine: number[];
    };

    expect(payload.n).toBe(2);
    expect(payload.slots).toContainEqual({ i: 1, count: 2 });
    expect(payload.mine).toEqual([1]);
    expect(JSON.stringify(payload)).not.toContain("participant_id");
  });
});
