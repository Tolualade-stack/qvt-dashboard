// Shared helper for the setup scripts in this folder.
// Talks to the Supabase Management API using SUPABASE_ACCESS_TOKEN from .env.local.
// Run the scripts through npm (see package.json), which loads .env.local for them.

const API = "https://api.supabase.com/v1";

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env.local. See .env.example for where to find it.`);
    process.exit(1);
  }
  return value;
}

// The project reference is the first part of the project URL:
// https://<ref>.supabase.co
export function projectRef() {
  return new URL(required("NEXT_PUBLIC_SUPABASE_URL")).hostname.split(".")[0];
}

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${required("SUPABASE_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase API ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// Runs SQL on the project database and returns the result rows.
export function runSql(query) {
  return call("POST", `/projects/${projectRef()}/database/query`, { query });
}

// Updates the project's login (Auth) settings.
export function updateAuthConfig(settings) {
  return call("PATCH", `/projects/${projectRef()}/config/auth`, settings);
}

// Quotes a value for safe use inside SQL text.
export function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
