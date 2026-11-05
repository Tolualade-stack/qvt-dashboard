"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadMyWork } from "@/lib/work";
import { CHECK_IN_NOTE, type WorkAction, type WorkKind } from "@/lib/work-items";

// One-tap updates from My work and the + button. They change the same records as
// the trackers, so the World page, flags and history all stay right. The database
// decides who may change what; when it refuses, no row comes back and we say so.

export type Undo =
  | { type: "content"; id: string; status: string }
  | { type: "ad"; id: string; status: string }
  | { type: "ad_issue"; id: string }
  | { type: "funds"; id: string }
  | { type: "report"; id: string }
  | { type: "asset"; id: string; created: boolean; status: string }
  | { type: "deliverable"; id: string; done: number }
  | { type: "issue"; id: string; resolved: boolean };

export type QuickResult = { ok: boolean; message: string; undo?: Undo };

const NOT_YOURS = "Someone else covers this, or it just changed. Refresh to see the latest.";

function refresh(brandId: string) {
  revalidatePath(`/brands/${brandId}`, "layout");
  revalidatePath("/", "layout");
}

const failed = (message: string): QuickResult => ({ ok: false, message });

export async function quickUpdate(input: {
  kind: WorkKind;
  id: string;
  brandId: string;
  campaignId: string | null;
  title: string;
  action: WorkAction;
  note?: string;
  amount?: string;
  currency?: "NGN" | "USD";
}): Promise<QuickResult> {
  const supabase = await createClient();
  const { kind, id, brandId, campaignId, title, action } = input;
  const note = input.note?.trim() ?? "";
  let message = "Saved. Everyone can see it.";
  let undo: Undo | undefined;
  let logLine: string | null = null;

  const setContent = async (status: string) => {
    const { data: row } = await supabase.from("content_items").select("status").eq("id", id).single();
    if (!row) return false;
    const { data } = await supabase.from("content_items").update({ status }).eq("id", id).select("id");
    if (!data?.length) return false;
    undo = { type: "content", id, status: row.status };
    return true;
  };
  const setAd = async (status: string) => {
    const { data: row } = await supabase.from("ads").select("status").eq("id", id).single();
    if (!row) return false;
    const { data } = await supabase.from("ads").update({ status }).eq("id", id).select("id");
    if (!data?.length) return false;
    undo = { type: "ad", id, status: row.status };
    return true;
  };

  if (action === "content:posted") {
    if (!(await setContent("posted"))) return failed(NOT_YOURS);
    message = "Posted. Everyone can see it.";
  } else if (action === "content:approved") {
    if (!(await setContent("approved"))) return failed(NOT_YOURS);
    message = "Approved. Everyone can see it.";
  } else if (action.startsWith("content:next:")) {
    if (!(await setContent(action.slice("content:next:".length)))) return failed(NOT_YOURS);
  } else if (action === "ad:live") {
    if (!(await setAd("live"))) return failed(NOT_YOURS);
    message = "Ad is live. Everyone can see it.";
    logLine = `Ad live: ${title}`;
  } else if (action === "ad:ended") {
    if (!(await setAd("ended"))) return failed(NOT_YOURS);
    message = "Ad ended.";
    logLine = `Ad ended: ${title}`;
  } else if (action === "ad:funds") {
    const value = Number(String(input.amount ?? "").replace(/[,\s₦$]/g, ""));
    if (!Number.isFinite(value) || value <= 0) return failed("Enter the amount needed.");
    const { data, error } = await supabase
      .from("fund_requests")
      .insert({ brand_id: brandId, ad_id: id, amount: value, currency: input.currency === "USD" ? "USD" : "NGN", note: note || null })
      .select("id");
    if (error || !data?.length) return failed(NOT_YOURS);
    undo = { type: "funds", id: data[0].id };
    message = "Fund request sent. It's flagged if still pending after 24 hours.";
    logLine = `Need funds: ${title}`;
  } else if (action === "report:sent") {
    const { data } = await supabase.from("reports").update({ sent_at: new Date().toISOString() }).eq("id", id).select("id");
    if (!data?.length) return failed(NOT_YOURS);
    undo = { type: "report", id };
    message = "Report sent. Everyone can see it.";
    logLine = `Report sent: ${title}`;
  } else if (action === "asset:deployed") {
    // The next asset in production, or a new entry if none has been added by hand.
    const { data: waiting } = await supabase
      .from("creative_assets")
      .select("id, status")
      .eq("campaign_id", id)
      .eq("is_archived", false)
      .neq("status", "deployed")
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (waiting) {
      const { data } = await supabase.from("creative_assets").update({ status: "deployed" }).eq("id", waiting.id).select("id");
      if (!data?.length) return failed(NOT_YOURS);
      undo = { type: "asset", id: waiting.id, created: false, status: waiting.status };
    } else {
      const { count } = await supabase.from("creative_assets").select("id", { count: "exact", head: true }).eq("campaign_id", id);
      const { data } = await supabase
        .from("creative_assets")
        .insert({ brand_id: brandId, campaign_id: id, title: `Asset ${(count ?? 0) + 1}`, status: "deployed" })
        .select("id");
      if (!data?.length) return failed(NOT_YOURS);
      undo = { type: "asset", id: data[0].id, created: true, status: "deployed" };
    }
    message = "1 more deployed.";
    logLine = "1 more creative asset deployed";
  } else if (action === "deliverable:more") {
    const { data: row } = await supabase.from("campaign_deliverables").select("done_qty, planned_qty, unit").eq("id", id).single();
    if (!row) return failed(NOT_YOURS);
    const done = row.done_qty + 1;
    const { data } = await supabase.from("campaign_deliverables").update({ done_qty: done }).eq("id", id).eq("done_qty", row.done_qty).select("id");
    if (!data?.length) return failed(NOT_YOURS);
    undo = { type: "deliverable", id, done: row.done_qty };
    const progress = row.planned_qty != null ? `${done} of ${row.planned_qty} ${row.unit}` : `${done} ${row.unit}`;
    message = `${progress}.`;
    logLine = `${title}: ${progress}`;
  } else if (action === "issue:raise") {
    if (kind === "ad") {
      const { data } = await supabase
        .from("ads")
        .update({ issue_raised_at: new Date().toISOString(), issue_note: note || "Issue raised" })
        .eq("id", id)
        .select("id");
      if (!data?.length) return failed(NOT_YOURS);
      undo = { type: "ad_issue", id };
    } else {
      const { data, error } = await supabase
        .from("work_issues")
        .insert({ brand_id: brandId, campaign_id: campaignId, item_type: kind, item_id: id, title, note: note || null })
        .select("id");
      if (error || !data?.length) return failed(NOT_YOURS);
      undo = { type: "issue", id: data[0].id, resolved: false };
    }
    message = "Issue raised. The Account Lead sees it on Attention and the 24 h clock starts.";
    logLine = `Issue: ${title}`;
  } else if (action === "issue:resolve") {
    if (kind === "ad") {
      const { data } = await supabase.from("ads").update({ issue_raised_at: null }).eq("id", id).select("id");
      if (!data?.length) return failed(NOT_YOURS);
    } else {
      const { data } = await supabase
        .from("work_issues")
        .update({ resolved_at: new Date().toISOString() })
        .eq("item_type", kind)
        .eq("item_id", id)
        .is("resolved_at", null)
        .select("id");
      if (!data?.length) return failed(NOT_YOURS);
    }
    message = "Issue marked as sorted.";
    logLine = `Issue sorted: ${title}`;
  } else {
    return failed("That can't be done from here.");
  }

  // Everything lands in the log. Content changes already show in the World's feed.
  const line = note && logLine ? `${logLine}. ${note}` : (logLine ?? (note ? `${title}: ${note}` : null));
  if (line) {
    await supabase.from("update_notes").insert({ brand_id: brandId, note: line, content_item_id: kind === "content" ? id : null });
  }

  refresh(brandId);
  return { ok: true, message, undo };
}

export async function undoUpdate(brandId: string, undo: Undo): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const run = async () => {
    switch (undo.type) {
      case "content":
        return supabase.from("content_items").update({ status: undo.status }).eq("id", undo.id).select("id");
      case "ad":
        return supabase.from("ads").update({ status: undo.status }).eq("id", undo.id).select("id");
      case "ad_issue":
        return supabase.from("ads").update({ issue_raised_at: null }).eq("id", undo.id).select("id");
      case "funds":
        return supabase.from("fund_requests").update({ status: "declined", note: "Requested by mistake" }).eq("id", undo.id).select("id");
      case "report":
        return supabase.from("reports").update({ sent_at: null }).eq("id", undo.id).select("id");
      case "asset":
        return undo.created
          ? supabase.from("creative_assets").update({ is_archived: true }).eq("id", undo.id).select("id")
          : supabase.from("creative_assets").update({ status: undo.status }).eq("id", undo.id).select("id");
      case "deliverable":
        return supabase.from("campaign_deliverables").update({ done_qty: undo.done }).eq("id", undo.id).select("id");
      case "issue":
        return supabase.from("work_issues").update({ resolved_at: new Date().toISOString() }).eq("id", undo.id).select("id");
    }
  };
  const result = await run();
  if (result.error || !result.data?.length) return { ok: false, message: "Couldn't undo that. Refresh to see the latest." };
  await supabase.from("update_notes").insert({ brand_id: brandId, note: "Undid the last update (made by mistake)." });
  refresh(brandId);
  return { ok: true, message: "Undone." };
}

// A note that isn't about one item.
export async function quickNote(brandId: string, note: string): Promise<{ ok: boolean; message: string }> {
  const text = note.trim();
  if (text.length < 3) return { ok: false, message: "Write what happened." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("update_notes").insert({ brand_id: brandId, note: text }).select("id");
  if (error || !data?.length) return { ok: false, message: "You don't have permission to update this brand right now." };
  refresh(brandId);
  return { ok: true, message: "Saved to the log." };
}

// "Nothing changed": recorded in the log of each brand this person has work on,
// so everyone can see they checked, and the no-update flag doesn't fire.
export async function checkInNothingChanged(): Promise<{ ok: boolean; message: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, message: "Please sign in again." };
  const supabase = await createClient();
  const { items } = await loadMyWork(supabase, me);
  const brandIds = [...new Set(items.map((i) => i.brandId))];
  if (brandIds.length === 0) return { ok: true, message: "You have nothing open." };
  const { error } = await supabase.from("update_notes").insert(brandIds.map((brand_id) => ({ brand_id, note: CHECK_IN_NOTE })));
  if (error) return { ok: false, message: "Couldn't save that. Please try again." };
  for (const id of brandIds) revalidatePath(`/brands/${id}`, "layout");
  revalidatePath("/", "layout");
  return { ok: true, message: "Checked in." };
}
