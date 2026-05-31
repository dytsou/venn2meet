import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = resolve(root, ".env.example");
const envPath = resolve(root, ".env");
const force = process.argv.includes("--force");

if (!existsSync(examplePath)) {
  console.error(".env.example not found");
  process.exit(1);
}

if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath);
  console.log("Created .env from .env.example");
}

const secret = randomBytes(32).toString("hex");
let content = readFileSync(envPath, "utf8");

const hasSessionSecret = /^SESSION_SECRET=(.+)$/m.test(content);
const sessionSecretValue = content.match(/^SESSION_SECRET=(.+)$/m)?.[1]?.trim();

if (hasSessionSecret && sessionSecretValue && !force) {
  console.log("SESSION_SECRET already set in .env (use --force to replace)");
  process.exit(0);
}

if (/^#?\s*SESSION_SECRET=.*$/m.test(content)) {
  content = content.replace(/^#?\s*SESSION_SECRET=.*$/m, `SESSION_SECRET=${secret}`);
} else {
  content = `${content.trimEnd()}\nSESSION_SECRET=${secret}\n`;
}

writeFileSync(envPath, content);
console.log("SESSION_SECRET generated and written to .env");
