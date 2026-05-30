import { Hono } from "hono";
import { createEventRoute } from "./routes/events";
import { createGridRoute } from "./routes/grid";
import { createAvailabilityRoute } from "./routes/availability";
import { eventPageRoute } from "./routes/pages";

export type Env = {
  Bindings: {
    DB: D1Database;
    SESSION_SECRET: string;
    CREATE_RATE_LIMIT?: number;
    JOIN_RATE_LIMIT?: number;
    WRITE_RATE_LIMIT?: number;
  };
};

export const app = new Hono<Env>();

app.get("/api/health", (c) => {
  return c.json({ ok: true });
});

app.post("/api/events", createEventRoute);
app.get("/api/events/:token/grid", createGridRoute);
app.patch("/api/events/:token/availability", createAvailabilityRoute);
app.get("/e/:token", eventPageRoute);
