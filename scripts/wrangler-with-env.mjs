import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(resolve(root, ".env"));

const dbId = process.env.D1_DATABASE_ID;
if (!dbId) {
  console.error("D1_DATABASE_ID is required in .env");
  process.exit(1);
}

const source = readFileSync(resolve(root, "wrangler.jsonc"), "utf8")
  .replace(/\/\/.*$/gm, "")
  .replace(/,\s*(\s*[}\]])/g, "$1");
const config = JSON.parse(source);
if (config.main) config.main = resolve(root, config.main);
if (config.assets?.directory) config.assets.directory = resolve(root, config.assets.directory);
if (config.$schema) config.$schema = resolve(root, config.$schema);
for (const db of config.d1_databases ?? []) {
  db.database_id = dbId;
  db.migrations_dir = resolve(root, db.migrations_dir ?? "migrations");
}

const outDir = resolve(root, ".wrangler");
mkdirSync(outDir, { recursive: true });
const configPath = resolve(outDir, "config.jsonc");
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

const wrangler = resolve(root, "node_modules/.bin/wrangler");
const args = [...process.argv.slice(2), "--config", configPath];
const result = spawnSync(wrangler, args, { cwd: root, stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env is optional if vars are already exported (e.g. CI).
  }
}
