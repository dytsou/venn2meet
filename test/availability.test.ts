import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { resetRateLimitsForTest } from "../src/middleware/rate-limit";
import { FakeD1Database } from "./support/fake-d1";

type TestEnv = {
  DB: D1Database;
  SESSION_SECRET: string;
  CREATE_RATE_LIMIT?: number;
  JOIN_RATE_LIMIT?: number;
  WRITE_RATE_LIMIT?: number;
};

function buildEnv(): TestEnv {
  resetRateLimitsForTest();
  return {
    DB: new FakeD1Database() as unknown as D1Database,
    SESSION_SECRET: "test-secret",
    CREATE_RATE_LIMIT: 100,
    JOIN_RATE_LIMIT: 100,
    WRITE_RATE_LIMIT: 100
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
  return raw ? raw.split(";")[0] ?? null : null;
}

async function createEvent(env: TestEnv, payload?: Partial<Record<string, unknown>>) {
  const response = await apiRequest({
    env,
    path: "/api/events",
    method: "POST",
    body: {
      title: "Large Event",
      timezone: "UTC",
      startIso: "2026-06-01T00:00:00.000Z",
      endIso: "2026-06-08T00:00:00.000Z",
      granularityMinutes: 15,
      ...(payload ?? {})
    }
  });

  const body = (await response.json()) as { token: string };
  return {
    token: body.token,
    cookie: parseCookie(response) as string
  };
}

describe("availability sync", () => {
  it("supports selecting 50 slots in one request", async () => {
    const env = buildEnv();
    const { token, cookie } = await createEvent(env);

    const select = Array.from({ length: 50 }, (_, i) => i);
    const write = await apiRequest({
      env,
      path: `/api/events/${token}/availability`,
      method: "PATCH",
      cookie,
      body: { select, deselect: [] }
    });

    expect(write.status).toBe(200);

    const grid = await apiRequest({
      env,
      path: `/api/events/${token}/grid`,
      cookie
    });
    const payload = (await grid.json()) as {
      n: number;
      slots: Array<{ i: number; count: number }>;
    };

    expect(payload.n).toBe(1);
    expect(payload.slots).toHaveLength(50);
  });

  it("drops participant out of N after deselecting all slots", async () => {
    const env = buildEnv();
    const { token, cookie } = await createEvent(env);

    await apiRequest({
      env,
      path: `/api/events/${token}/availability`,
      method: "PATCH",
      cookie,
      body: { select: [2, 4], deselect: [] }
    });

    const clear = await apiRequest({
      env,
      path: `/api/events/${token}/availability`,
      method: "PATCH",
      cookie,
      body: { select: [], deselect: [2, 4] }
    });
    expect(clear.status).toBe(200);

    const grid = await apiRequest({
      env,
      path: `/api/events/${token}/grid`,
      cookie
    });
    await expect(grid.json()).resolves.toMatchObject({
      n: 0,
      slots: []
    });
  });

  it("does not double count duplicate slot selects from one participant", async () => {
    const env = buildEnv();
    const { token, cookie } = await createEvent(env);

    const first = await apiRequest({
      env,
      path: `/api/events/${token}/availability`,
      method: "PATCH",
      cookie,
      body: { select: [12], deselect: [] }
    });
    expect(first.status).toBe(200);

    const second = await apiRequest({
      env,
      path: `/api/events/${token}/availability`,
      method: "PATCH",
      cookie,
      body: { select: [12], deselect: [] }
    });
    expect(second.status).toBe(200);

    const grid = await apiRequest({
      env,
      path: `/api/events/${token}/grid`,
      cookie
    });
    const payload = (await grid.json()) as {
      slots: Array<{ i: number; count: number }>;
    };

    expect(payload.slots).toContainEqual({ i: 12, count: 1 });
  });

  it("recalculates N when a new participant submits first slot (AE4)", async () => {
    const env = buildEnv();
    const { token, cookie: cookieA } = await createEvent(env);

    const joinB = await apiRequest({ env, path: `/api/events/${token}/grid` });
    const cookieB = parseCookie(joinB) as string;
    const joinC = await apiRequest({ env, path: `/api/events/${token}/grid` });
    const cookieC = parseCookie(joinC) as string;

    for (const cookie of [cookieA, cookieB, cookieC]) {
      const res = await apiRequest({
        env,
        path: `/api/events/${token}/availability`,
        method: "PATCH",
        cookie,
        body: { select: [20], deselect: [] }
      });
      expect(res.status).toBe(200);
    }

    const before = await apiRequest({
      env,
      path: `/api/events/${token}/grid`,
      cookie: cookieA
    });
    const beforePayload = (await before.json()) as {
      n: number;
      slots: Array<{ i: number; count: number }>;
    };
    expect(beforePayload.n).toBe(3);
    expect(beforePayload.slots).toContainEqual({ i: 20, count: 3 });

    const joinD = await apiRequest({ env, path: `/api/events/${token}/grid` });
    const cookieD = parseCookie(joinD) as string;

    const writeD = await apiRequest({
      env,
      path: `/api/events/${token}/availability`,
      method: "PATCH",
      cookie: cookieD,
      body: { select: [30], deselect: [] }
    });
    expect(writeD.status).toBe(200);

    const after = await apiRequest({
      env,
      path: `/api/events/${token}/grid`,
      cookie: cookieA
    });
    const afterPayload = (await after.json()) as {
      n: number;
      slots: Array<{ i: number; count: number }>;
    };

    expect(afterPayload.n).toBe(4);
    expect(afterPayload.slots).toContainEqual({ i: 20, count: 3 });
  });
});
