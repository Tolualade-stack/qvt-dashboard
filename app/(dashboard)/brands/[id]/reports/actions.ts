"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type FormState } from "@/lib/form-state";
import { NEXT_ASSET_STATUS, type AssetStatus } from "@/lib/reports";

// Report and creative-asset actions. The database decides who may change a
// brand's reports and assets, and records the real "sent" and "deployed" times.

const NO_PERMISSION = "You don't have permission to update this brand right now.";

function refresh(brandId: string) {
  revalidatePath(`/brands/${brandId}`, "layout");
  revalidatePath("/");
}

async function done(query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, brandId: string, message: string) {
  const { data, error } = await query;
  if (error) return fail(error.message);
  if (!data?.length) return fail(NO_PERMISSION);
  refresh(brandId);
  return ok(message);
}

const link = (value: FormDataEntryValue | null) => {
  const s = String(value ?? "").trim();
  return s ? s : null;
};

export async function markReportSent(reportId: string, brandId: string, sent: boolean): Promise<FormState> {
  const supabase = await createClient();
  return done(
    supabase.from("reports").update({ sent_at: sent ? new Date().toISOString() : null }).eq("id", reportId).select("id"),
    brandId,
    sent ? "Marked as sent." : "Marked as not sent.",
  );
}

export async function saveReportLink(reportId: string, brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const url = link(formData.get("link"));
  if (url && !/^https?:\/\/\S+$/.test(url)) return fail("Paste the full link, starting with https://");
  const supabase = await createClient();
  return done(supabase.from("reports").update({ link: url }).eq("id", reportId).select("id"), brandId, "Report link saved.");
}

// An extra report outside the regular rhythm, e.g. for a partnership.
export async function addReport(brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const label = String(formData.get("period_label") ?? "").trim();
  const due = String(formData.get("due_date") ?? "");
  if (label.length < 2) return fail("Say what the report is for.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return fail("Choose the due date.");
  const supabase = await createClient();
  return done(
    supabase
      .from("reports")
      // Due by the end of that day, Lagos time (UTC+1).
      .insert({ brand_id: brandId, kind: "other", period_label: label, due_at: `${due}T22:59:00Z` })
      .select("id"),
    brandId,
    "Report added.",
  );
}

export async function addAsset(brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 2) return fail("Give the asset a name.");
  const url = link(formData.get("link"));
  if (url && !/^https?:\/\/\S+$/.test(url)) return fail("Paste the full link, starting with https://");
  const supabase = await createClient();
  return done(
    supabase
      .from("creative_assets")
      .insert({
        brand_id: brandId,
        title,
        asset_type: String(formData.get("asset_type") ?? "") || null,
        link: url,
        owner_person_id: String(formData.get("owner_person_id") ?? "") || null,
      })
      .select("id"),
    brandId,
    `"${title}" added as In production.`,
  );
}

export async function advanceAsset(assetId: string, brandId: string): Promise<FormState> {
  const supabase = await createClient();
  const { data: asset } = await supabase.from("creative_assets").select("status").eq("id", assetId).single();
  if (!asset) return fail("That asset no longer exists.");
  const next = NEXT_ASSET_STATUS[asset.status as AssetStatus];
  if (!next) return ok("Already deployed.");
  return done(
    supabase.from("creative_assets").update({ status: next }).eq("id", assetId).eq("status", asset.status).select("id"),
    brandId,
    "Updated.",
  );
}
