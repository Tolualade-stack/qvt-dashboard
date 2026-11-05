import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

// The team as the setup screens need them: name, email and whether they can sign
// in. Only the Admin reaches these screens.
export async function loadWizardPeople(supabase: Client) {
  const [{ data: peopleRows }, { data: profileRows }] = await Promise.all([
    supabase.from("people").select("id, full_name, email, is_placeholder, is_active").order("full_name"),
    supabase.from("profiles").select("person_id, email"),
  ]);
  const loginEmail = new Map((profileRows ?? []).map((p) => [p.person_id as string | null, p.email as string]));
  return (peopleRows ?? [])
    .filter((p) => !p.is_placeholder && p.is_active)
    .map((p) => ({
      id: p.id as string,
      name: p.full_name as string,
      email: (p.email as string | null) ?? loginEmail.get(p.id) ?? null,
      hasLogin: loginEmail.has(p.id),
    }));
}
