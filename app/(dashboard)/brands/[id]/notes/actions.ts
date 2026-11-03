"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type FormState } from "@/lib/form-state";
import { SOURCE_LABELS, type NoteSource } from "@/lib/notes";

// Saves a "What changed?" note. Who wrote it, and when, are filled in by the
// database from the login; the app cannot set them.
export async function addNote(brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const note = String(formData.get("note") ?? "").trim();
  if (note.length < 3) return fail("Write what changed.");
  const source = String(formData.get("source") ?? "");
  const contentItemId = String(formData.get("content_item_id") ?? "") || null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("update_notes")
    .insert({
      brand_id: brandId,
      note,
      content_item_id: contentItemId,
      source: source in SOURCE_LABELS ? (source as NoteSource) : null,
    })
    .select("id");
  if (error) return fail(error.code === "42501" ? "You don't have permission to update this brand right now." : error.message);
  if (!data?.length) return fail("You don't have permission to update this brand right now.");

  revalidatePath(`/brands/${brandId}`, "layout");
  revalidatePath("/log");
  return ok("Saved to the update log.");
}
