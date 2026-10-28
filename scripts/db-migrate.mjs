// Applies any database changes in supabase/migrations that have not run yet.
// Usage: npm run db:migrate
//
// Files run in name order (0001_..., 0002_...). Each file runs inside a single
// transaction: it either applies completely or not at all. Applied file names are
// recorded in private.schema_migrations, so running this again is always safe.

import { readdir, readFile } from "node:fs/promises";
import { runSql, sqlLiteral } from "./supabase-api.mjs";

const dir = new URL("../supabase/migrations/", import.meta.url);

await runSql(`
  create schema if not exists private;
  create table if not exists private.schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  );
`);

const applied = new Set(
  (await runSql("select name from private.schema_migrations")).map((row) => row.name),
);
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
const pending = files.filter((f) => !applied.has(f));

if (pending.length === 0) {
  console.log("Database is up to date. Nothing to apply.");
}

for (const file of pending) {
  const sql = await readFile(new URL(file, dir), "utf8");
  process.stdout.write(`Applying ${file} ... `);
  await runSql(`begin;\n${sql}\ninsert into private.schema_migrations (name) values (${sqlLiteral(file)});\ncommit;`);
  console.log("done");
}
