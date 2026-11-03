import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WorldForm } from "../world-form";

export const metadata: Metadata = { title: "Create a dashboard · PRIME" };

export default async function NewWorldPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: people } = await supabase
    .from("people")
    .select("id, full_name")
    .eq("is_active", true)
    .eq("is_placeholder", false)
    .order("full_name");

  return <WorldForm people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name }))} assignedRoles={[]} />;
}
