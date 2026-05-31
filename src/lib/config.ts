import type { Context } from "hono";
import type { Env } from "../app";

export function hasSessionSecret(c: Context<Env>): boolean {
  return (
    typeof c.env.SESSION_SECRET === "string" && c.env.SESSION_SECRET.length > 0
  );
}

export function requireSessionSecret(c: Context<Env>): string | Response {
  const secret = c.env.SESSION_SECRET;
  if (typeof secret !== "string" || secret.length === 0) {
    return c.json(
      { error: "Server misconfigured: SESSION_SECRET is not set" },
      503,
    );
  }
  return secret;
}
