"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type FormState } from "@/lib/form-state";

// Saves (or clears) a brand's Canva calendar link. The database decides whether
// this person may edit the brand; if not, no row is updated and we say so.
export async function saveCanvaLink(brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const url = String(formData.get("url") ?? "").trim();
  if (url && !/^https:\/\/\S+$/.test(url)) return fail("Paste the full link, starting with https://");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .update({ canva_calendar_url: url || null })
    .eq("id", brandId)
    .select("id");

  if (error) return fail(error.message);
  if (!data?.length) return fail("You don't have permission to edit this brand right now.");

  revalidatePath(`/brands/${brandId}`);
  return ok(url ? "Calendar link saved." : "Calendar link removed.");
}
