import { Hono } from "hono";

export type Env = {
  Bindings: {
    DB: D1Database;
  };
};

export const app = new Hono<Env>();

app.get("/api/health", (c) => {
  return c.json({ ok: true });
});
