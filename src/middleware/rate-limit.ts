import type { Context } from "hono";
import type { Env } from "../app";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function resetRateLimitsForTest(): void {
  buckets.clear();
}

function getClientKey(c: Context<Env>): string {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for") ??
    c.req.header("x-real-ip") ??
    "local"
  );
}

function envInt(c: Context<Env>, name: string, fallback: number): number {
  const raw = c.env[name as keyof Env["Bindings"]];
  if (typeof raw === "number") {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function limitFor(c: Context<Env>, key: "CREATE" | "JOIN" | "WRITE"): number {
  if (key === "CREATE") return envInt(c, "CREATE_RATE_LIMIT", 10);
  if (key === "JOIN") return envInt(c, "JOIN_RATE_LIMIT", 50);
  return envInt(c, "WRITE_RATE_LIMIT", 30);
}

export function enforceRateLimit(c: Context<Env>, config: { bucket: string; limit: number }): boolean {
  const key = `${config.bucket}:${getClientKey(c)}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (current.count >= config.limit) {
    return false;
  }

  current.count += 1;
  buckets.set(key, current);
  return true;
}
