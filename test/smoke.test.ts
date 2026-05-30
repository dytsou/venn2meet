import { describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("smoke", () => {
  it("returns ok from /api/health", async () => {
    const request = new Request("http://example.com/api/health");
    const response = await app.request(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
