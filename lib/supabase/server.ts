import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// Supabase client acting as the logged-in person (their session comes from cookies).
// Everything done with it is checked by the database's access rules.
// Create a new one for every request; never share it.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Pages cannot set cookies while rendering. That is fine: proxy.ts
          // refreshes the session on every request.
        }
      },
    },
  });
}
