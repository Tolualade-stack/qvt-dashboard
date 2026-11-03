"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type FormState } from "@/lib/form-state";
import { AD_MOVES, type AdStatus, type Currency } from "@/lib/ads";

// Ads tracker actions. As with content, the database decides who may change a
// brand's ads; when it refuses, no row comes back and we say so.

const NO_PERMISSION = "You don't have permission to update this brand right now.";

function refresh(brandId: string) {
  revalidatePath(`/brands/${brandId}`, "layout");
  revalidatePath("/");
}

const amount = (value: FormDataEntryValue | null) => {
  const n = Number(String(value ?? "").replace(/[,\s₦$]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const currencyOf = (value: FormDataEntryValue | null): Currency => (value === "USD" ? "USD" : "NGN");

async function changed(query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>, brandId: string, done: string) {
  const { data, error } = await query;
  if (error) return fail(error.message);
  if (!data?.length) return fail(NO_PERMISSION);
  refresh(brandId);
  return ok(done);
}

export async function addAd(brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "");
  if (name.length < 2) return fail("Give the ad a name.");
  if (!channel) return fail("Choose the channel.");
  const supabase = await createClient();
  return changed(
    supabase
      .from("ads")
      .insert({
        brand_id: brandId,
        name,
        channel,
        format: String(formData.get("format") ?? "") || null,
        owner_person_id: String(formData.get("owner_person_id") ?? "") || null,
        currency: currencyOf(formData.get("currency")),
        budget: amount(formData.get("budget")),
        notes: String(formData.get("notes") ?? "").trim() || null,
      })
      .select("id"),
    brandId,
    `"${name}" added as Not started.`,
  );
}

export async function updateAd(adId: string, brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return fail("Give the ad a name.");
  const supabase = await createClient();
  return changed(
    supabase
      .from("ads")
      .update({
        name,
        channel: String(formData.get("channel") ?? ""),
        format: String(formData.get("format") ?? "") || null,
        owner_person_id: String(formData.get("owner_person_id") ?? "") || null,
        currency: currencyOf(formData.get("currency")),
        budget: amount(formData.get("budget")),
        notes: String(formData.get("notes") ?? "").trim() || null,
      })
      .eq("id", adId)
      .select("id"),
    brandId,
    "Saved.",
  );
}

// One tap: only moves allowed from the ad's current stage are accepted.
export async function moveAd(adId: string, brandId: string, to: AdStatus): Promise<FormState> {
  const supabase = await createClient();
  const { data: ad } = await supabase.from("ads").select("status").eq("id", adId).single();
  if (!ad) return fail("That ad no longer exists.");
  if (!AD_MOVES[ad.status as AdStatus].some((m) => m.to === to)) return fail("That ad has already moved on. Refresh to see the latest.");
  return changed(supabase.from("ads").update({ status: to }).eq("id", adId).eq("status", ad.status).select("id"), brandId, "Updated.");
}

export async function updateSpend(adId: string, brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const spend = amount(formData.get("spend"));
  if (spend === null) return fail("Enter the spend so far, as a number.");
  const supabase = await createClient();
  return changed(supabase.from("ads").update({ spend_to_date: spend }).eq("id", adId).select("id"), brandId, "Spend updated.");
}

// Underperformance flagged: the database stamps the time (the 24-hour clock).
export async function raiseIssue(adId: string, brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const note = String(formData.get("issue_note") ?? "").trim();
  if (note.length < 3) return fail("Say briefly what's wrong, e.g. CTR below target.");
  const supabase = await createClient();
  return changed(
    supabase.from("ads").update({ issue_raised_at: new Date().toISOString(), issue_note: note }).eq("id", adId).select("id"),
    brandId,
    "Issue raised. Escalate within 24 hours if it isn't fixed.",
  );
}

export async function resolveIssue(adId: string, brandId: string): Promise<FormState> {
  const supabase = await createClient();
  return changed(supabase.from("ads").update({ issue_raised_at: null }).eq("id", adId).select("id"), brandId, "Issue resolved.");
}

export async function requestFunds(adId: string, brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const value = amount(formData.get("amount"));
  if (!value) return fail("Enter the amount needed.");
  const supabase = await createClient();
  return changed(
    supabase
      .from("fund_requests")
      .insert({ brand_id: brandId, ad_id: adId, amount: value, currency: currencyOf(formData.get("currency")), note: String(formData.get("note") ?? "").trim() || null })
      .select("id"),
    brandId,
    "Fund request logged. It's flagged if still pending after 24 hours.",
  );
}

export async function resolveFunds(requestId: string, brandId: string, status: "funded" | "declined"): Promise<FormState> {
  const supabase = await createClient();
  return changed(
    supabase.from("fund_requests").update({ status }).eq("id", requestId).eq("status", "pending").select("id"),
    brandId,
    status === "funded" ? "Marked as funded." : "Marked as declined.",
  );
}
