import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { worldTheme } from "@/lib/colour";
import { CHANNELS } from "@/lib/campaign";
import type { Brand } from "@/lib/types";

// What every screen inside a brand's world needs: the brand, its colours, the
// platforms content can go on, its current team, and whether this person can edit.
export async function loadWorld(id: string) {
  const supabase = await createClient();
  const [me, { data: brandRow }, { data: teamRows }] = await Promise.all([
    getCurrentUser(),
    supabase.from("brands").select("*").eq("id", id).maybeSingle(),
    supabase.from("brand_roles").select("person_id, people(id, full_name, is_placeholder)").eq("brand_id", id).is("ended_at", null),
  ]);
  if (!brandRow || !me) notFound();
  const brand = brandRow as Brand;

  // Mirrors the database rule can_edit_brand(); the database still has the final say.
  const canEdit =
    me.role === "admin" ||
    me.role === "updates_manager" ||
    (me.role === "leave_cover" && brand.leave_mode_on && brand.leave_cover_person_id === me.personId);

  const platforms: { id: string; label: string }[] = [
    ...brand.channels.map((cid) => ({ id: cid, label: CHANNELS.find((c) => c.id === cid)?.label ?? cid })),
    ...(brand.marketing_types.includes("traditional") ? [{ id: "tv", label: "TV" }, { id: "radio", label: "Radio" }] : []),
  ];

  // The brand's current team, once each, real people only.
  const seen = new Set<string>();
  const people: { id: string; label: string }[] = [];
  for (const row of teamRows ?? []) {
    const person = row.people as unknown as { id: string; full_name: string; is_placeholder: boolean } | null;
    if (person && !person.is_placeholder && !seen.has(person.id)) {
      seen.add(person.id);
      people.push({ id: person.id, label: person.full_name });
    }
  }
  people.sort((a, b) => a.label.localeCompare(b.label));

  return { me, brand, theme: worldTheme(brand.colour), platforms, people, canEdit, supabase };
}

export function platformLabel(platforms: { id: string; label: string }[], ids: string[]) {
  return ids.map((id) => platforms.find((p) => p.id === id)?.label ?? id).join(", ");
}
