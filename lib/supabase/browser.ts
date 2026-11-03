import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Supabase client for code running in the browser, acting as the logged-in
// person. Used to upload images straight to storage (faster than going through
// the server, and no size limit on the way). Storage rules still apply.
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabasePublishableKey);
}
