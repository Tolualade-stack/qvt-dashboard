"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type FormState } from "@/lib/form-state";
import { nextStatus, type ContentStatus } from "@/lib/content";

// Content tracker actions. The database decides who may change a brand's content
// (Admin, Updates Manager, leave cover during Leave Mode); when it refuses, no row
// comes back and we say so.

const NO_PERMISSION = "You don't have permission to update this brand right now.";

function refresh(brandId: string) {
  revalidatePath(`/brands/${brandId}`, "layout");
  revalidatePath("/");
}

function readFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    platforms: formData.getAll("platforms").map(String),
    owner_person_id: String(formData.get("owner_person_id") ?? "") || null,
    planned_date: String(formData.get("planned_date") ?? "") || null,
    needs_approval: formData.get("needs_approval") === "on",
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
}

export async function addContent(brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFields(formData);
  if (fields.title.length < 2) return fail("Give the content piece a title.");

  const supabase = await createClient();
  const { data, error } = await supabase.from("content_items").insert({ ...fields, brand_id: brandId }).select("id");
  if (error) return fail(error.code === "42501" ? NO_PERMISSION : error.message);
  if (!data?.length) return fail(NO_PERMISSION);
  refresh(brandId);
  return ok(`"${fields.title}" added as Planned.`);
}

export async function updateContent(itemId: string, brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const fields = readFields(formData);
  if (fields.title.length < 2) return fail("Give the content piece a title.");
  const postUrl = String(formData.get("post_url") ?? "").trim();
  if (postUrl && !/^https?:\/\/\S+$/.test(postUrl)) return fail("Paste the full post link, starting with https://");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_items")
    .update({ ...fields, post_url: postUrl || null })
    .eq("id", itemId)
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail(NO_PERMISSION);
  refresh(brandId);
  return ok("Saved.");
}

// The one-tap button: moves a piece to its next stage. Reads the current stage
// first so two people tapping at once cannot skip a stage.
export async function advanceContent(itemId: string, brandId: string): Promise<FormState> {
  const supabase = await createClient();
  const { data: item } = await supabase.from("content_items").select("status, needs_approval").eq("id", itemId).single();
  if (!item) return fail("That content piece no longer exists.");
  const next = nextStatus(item.status as ContentStatus, item.needs_approval);
  if (!next) return ok("Already posted.");

  const { data, error } = await supabase
    .from("content_items")
    .update({ status: next })
    .eq("id", itemId)
    .eq("status", item.status)
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail("Someone else just updated this piece. Refresh to see the latest.");
  refresh(brandId);
  return ok("Updated.");
}

// Sent back from approval for changes. The database counts the revision round.
export async function sendBackContent(itemId: string, brandId: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("content_items")
    .update({ status: "asset_in_progress" })
    .eq("id", itemId)
    .eq("status", "awaiting_approval")
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail("Only pieces awaiting approval can be sent back.");
  refresh(brandId);
  return ok("Sent back for changes.");
}

export async function savePostLink(itemId: string, brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const url = String(formData.get("post_url") ?? "").trim();
  if (url && !/^https?:\/\/\S+$/.test(url)) return fail("Paste the full post link, starting with https://");
  const supabase = await createClient();
  const { data, error } = await supabase.from("content_items").update({ post_url: url || null }).eq("id", itemId).select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail(NO_PERMISSION);
  refresh(brandId);
  return ok(url ? "Post link saved." : "Post link removed.");
}

export async function archiveContent(itemId: string, brandId: string) {
  const supabase = await createClient();
  await supabase.from("content_items").update({ is_archived: true }).eq("id", itemId);
  refresh(brandId);
}
