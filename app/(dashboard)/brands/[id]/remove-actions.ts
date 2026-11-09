"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Removing things. Tracked work (content, ads, assets, counted work) is archived:
// it disappears everywhere but stays in the history, and anyone who can update
// it can remove it. Campaigns, hand-added reports and whole brands are truly
// deleted, by the Admin only.

type Result = { ok: boolean; message: string };
const NO = "You can't remove this. It may be someone else's area, or already gone.";

function refresh(brandId: string) {
  revalidatePath(`/brands/${brandId}`, "layout");
  revalidatePath("/", "layout");
}

const ARCHIVABLE = {
  content: "content_items",
  ad: "ads",
  asset: "creative_assets",
  deliverable: "campaign_deliverables",
} as const;

export async function removeWork(kind: keyof typeof ARCHIVABLE, id: string, brandId: string): Promise<Result> {
  const supabase = await createClient();
  const { data } = await supabase.from(ARCHIVABLE[kind]).update({ is_archived: true }).eq("id", id).eq("brand_id", brandId).select("id");
  if (!data?.length) return { ok: false, message: NO };
  refresh(brandId);
  return { ok: true, message: "Removed." };
}

// Only reports added by hand. Regular ones come from the reporting rhythm and
// would simply be scheduled again.
export async function removeReport(id: string, brandId: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("reports").delete().eq("id", id).eq("kind", "other").select("id");
  if (!data?.length) return { ok: false, message: "Only reports added by hand can be removed." };
  refresh(brandId);
  return { ok: true, message: "Removed." };
}

export async function removeCanvaLink(brandId: string): Promise<Result> {
  const supabase = await createClient();
  const { data } = await supabase.from("brands").update({ canva_calendar_url: null }).eq("id", brandId).select("id");
  if (!data?.length) return { ok: false, message: NO };
  refresh(brandId);
  return { ok: true, message: "Link removed." };
}

export async function deleteCampaign(campaignId: string, brandId: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_campaign", { p_id: campaignId });
  if (error) return { ok: false, message: error.message };
  refresh(brandId);
  return { ok: true, message: "Campaign deleted." };
}

// Deletes a brand world and everything in it, for good. The Admin types the
// brand's name to confirm. Its images and uploaded files are removed too.
export async function deleteBrand(brandId: string, typedName: string): Promise<Result> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: brand } = await supabase.from("brands").select("name").eq("id", brandId).single();
  if (!brand) return { ok: false, message: "That world no longer exists." };
  if (typedName.trim().toLowerCase() !== brand.name.trim().toLowerCase()) {
    return { ok: false, message: `Type "${brand.name}" exactly to confirm.` };
  }

  const { data, error } = await supabase.from("brands").delete().eq("id", brandId).select("id");
  if (error) return { ok: false, message: error.message };
  if (!data?.length) return { ok: false, message: "Only the Admin can delete a world." };

  // Files in storage aren't linked to the database, so clear the brand's folders.
  const storage = createAdminClient().storage;
  for (const bucket of ["brand-media", "brand-documents"]) {
    const { data: files } = await storage.from(bucket).list(brandId, { limit: 1000 });
    if (files?.length) await storage.from(bucket).remove(files.map((f) => `${brandId}/${f.name}`));
  }

  revalidatePath("/", "layout");
  return { ok: true, message: `${brand.name} deleted.` };
}
