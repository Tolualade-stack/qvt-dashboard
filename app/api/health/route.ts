import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// A tiny check that touches the database, called once a day by GitHub
// (.github/workflows/keep-awake.yml). Supabase's free plan pauses a project
// after about a week with no activity, which takes the whole site down.
// It reads nothing private: without a login the access rules return no rows.
export async function GET() {
  const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession: false } });
  const { error } = await supabase.from("workspaces").select("id").limit(1);
  return Response.json({ ok: !error }, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
