import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, secretKey } from "@/lib/env";

// Supabase client with full access, bypassing the access rules.
// Server-only, and used ONLY for managing logins (creating them, resetting
// passwords, blocking sign-in), which the normal client cannot do.
// Always check the caller is an Admin before using it.
export function createAdminClient() {
  return createClient(env.supabaseUrl, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
