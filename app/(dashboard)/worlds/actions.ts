"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, type FormState } from "@/lib/form-state";

// Creates a brand's world (brandId = null) or saves changes to an existing one.
// Images are already uploaded by the browser; this receives their storage paths.

const HEX = /^#[0-9A-Fa-f]{6}$/;
const text = (value: FormDataEntryValue | null) => String(value ?? "").trim() || null;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";


export async function saveWorld(brandId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const colour = String(formData.get("colour") ?? "");
  if (name.length < 2) return fail("Give the brand a name (step 1).");
  if (!HEX.test(colour)) return fail("Choose the brand's main colour (step 1).");

  const website = text(formData.get("website"));
  if (website && !/^https?:\/\/\S+$/.test(website)) return fail("The website needs to start with https:// (step 2).");

  const fields = {
    name,
    colour: colour.toUpperCase(),
    palette: String(formData.get("palette") ?? "").split(",").filter((c) => HEX.test(c)),
    banner_path: text(formData.get("banner_path")),
    logo_path: text(formData.get("logo_path")),
    about: text(formData.get("about")),
    website,
    industry: text(formData.get("industry")),
    category: text(formData.get("category")),
    products: formData.getAll("products").map(String).filter(Boolean),
    leave_cover_person_id: text(formData.get("leave_cover_person_id")),
  };

  const supabase = await createClient();
  let id = brandId;

  if (id) {
    const { error } = await supabase.from("brands").update(fields).eq("id", id);
    if (error) return fail(error.message);
  } else {
    // A short fixed key from the name, made unique if needed.
    const base = slugify(name);
    const { data: taken } = await supabase.from("brands").select("id").like("id", `${base}%`);
    const takenIds = new Set((taken ?? []).map((b) => b.id));
    id = base;
    for (let n = 2; takenIds.has(id); n++) id = `${base}-${n}`;

    const [{ data: workspace }, { count }] = await Promise.all([
      supabase.from("workspaces").select("id").order("sort_order").limit(1).single(),
      supabase.from("brands").select("id", { count: "exact", head: true }),
    ]);
    const { error } = await supabase
      .from("brands")
      .insert({
        ...fields,
        id,
        workspace_id: workspace?.id,
        sort_order: (count ?? 0) + 1,
        // Filled in by its first campaign.
        tier: "medium",
        scope: "Campaign scope not set yet.",
        reporting: "As agreed per partnership",
        in_execution_cycle: true,
      });
    if (error) return fail(error.message);
  }

  revalidatePath("/", "layout");
  redirect(`/brands/${id}`);
}
