import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types";

export type CurrentUser = {
  userId: string;
  email: string;
  role: AppRole;
  personId: string | null;
  name: string;
};

// The logged-in person and their app role, or null if they are logged in but
// have no active login profile (e.g. a deactivated account).
// cache() means this runs once per page load, however many components ask.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("app_role, person_id, is_active, people(full_name)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;

  const person = profile.people as unknown as { full_name: string } | null;
  return {
    userId: user.id,
    email: user.email ?? "",
    role: profile.app_role as AppRole,
    personId: profile.person_id,
    name: person?.full_name ?? user.email ?? "Unknown",
  };
});

// For pages and actions only the Admin may use.
export async function requireAdmin(): Promise<CurrentUser> {
  const me = await getCurrentUser();
  if (me?.role !== "admin") redirect("/");
  return me;
}
