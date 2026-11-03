"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type FormState } from "@/lib/form-state";
import { CHANNELS } from "@/lib/campaign";

// The media plan, strategy and budget lines. Admin only (the database agrees).

function refresh(brandId: string) {
  revalidatePath(`/brands/${brandId}`, "layout");
}

const url = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const isUrl = (v: string | null) => !v || /^https?:\/\/\S+$/.test(v);

// Plan and strategy: a live link and/or an uploaded file (uploaded by the
// browser straight to private storage; this saves the paths).
export async function savePlanDocuments(brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const fields = {
    media_plan_url: url(formData.get("media_plan_url")),
    strategy_url: url(formData.get("strategy_url")),
    media_plan_path: url(formData.get("media_plan_path")),
    strategy_path: url(formData.get("strategy_path")),
  };
  if (!isUrl(fields.media_plan_url) || !isUrl(fields.strategy_url)) return fail("Links need to start with https://");
  const supabase = await createClient();
  const { data, error } = await supabase.from("brands").update(fields).eq("id", brandId).select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail("Only the Admin can change the plan.");
  refresh(brandId);
  return ok("Plan and strategy saved.");
}

// Turns a typed channel name ("TikTok", "google ads", "TV") into PRIME's channel id.
function channelId(name: string): string {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  const match = CHANNELS.find((c) => c.label.toLowerCase() === n || c.id === n.replace(/ /g, "_"));
  if (match) return match.id;
  // Common ways media plans name channels.
  const rules: [RegExp, string][] = [
    [/instagram|\big\b/, "instagram"],
    [/facebook|\bfb\b|\bmeta\b/, "facebook"],
    [/tik ?tok/, "tiktok"],
    [/youtube|\byt\b/, "youtube"],
    [/google|search|display|pmax|performance max|demand gen/, "google_ads"],
    [/linkedin/, "linkedin"],
    [/twitter|^x\b|\bx \(/, "x"],
    [/\btv\b|television|tvc/, "tv"],
    [/radio/, "radio"],
    [/ooh|billboard|outdoor/, "ooh"],
    [/influenc|kol/, "influencers"],
    [/\bpr\b|public relations|press/, "pr"],
    [/activation|experiential|event/, "activations"],
  ];
  return rules.find(([re]) => re.test(n))?.[1] ?? (n.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "other");
}

const money = (v: string) => {
  const n = Number(v.replace(/[₦$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export async function addBudgetLine(brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const channel = String(formData.get("channel") ?? "");
  const amount = money(String(formData.get("planned_amount") ?? ""));
  if (!channel) return fail("Choose the channel.");
  if (amount === null) return fail("Enter the planned amount as a number.");
  const supabase = await createClient();
  const { count } = await supabase.from("budget_lines").select("id", { count: "exact", head: true }).eq("brand_id", brandId);
  const { error } = await supabase.from("budget_lines").insert({
    brand_id: brandId,
    channel,
    format: String(formData.get("format") ?? "").trim() || null,
    planned_amount: amount,
    currency: formData.get("currency") === "USD" ? "USD" : "NGN",
    sort_order: (count ?? 0) + 1,
  });
  if (error) return fail(error.message);
  refresh(brandId);
  return ok("Budget line added.");
}

// Rows pasted from a spreadsheet: Channel, Format, Amount, Currency (the last
// two optional, in any of these layouts). Tabs (copied from Excel or Sheets)
// or commas between columns.
export async function importBudgetLines(brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const text = String(formData.get("rows") ?? "").trim();
  if (!text) return fail("Paste the rows from your media plan.");

  const rows: { channel: string; format: string | null; planned_amount: number; currency: "NGN" | "USD" }[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const cells = raw.split(raw.includes("\t") ? "\t" : ",").map((c) => c.trim());
    if (cells.every((c) => !c)) continue;
    const amountIndex = cells.findIndex((c, i) => i > 0 && money(c) !== null && /\d/.test(c));
    if (amountIndex < 1) {
      if (!/channel/i.test(raw)) skipped.push(raw); // ignore a header row quietly
      continue;
    }
    const currencyCell = cells.find((c) => /^(usd|\$|ngn|₦|naira|dollars?)$/i.test(c)) ?? cells[amountIndex];
    rows.push({
      channel: channelId(cells[0]),
      format: amountIndex > 1 ? cells[1] || null : null,
      planned_amount: money(cells[amountIndex])!,
      currency: /usd|\$|dollar/i.test(currencyCell) ? "USD" : "NGN",
    });
  }
  if (rows.length === 0) return fail("Couldn't find any rows with an amount. Use: Channel, Format, Amount, Currency.");

  const supabase = await createClient();
  const { count } = await supabase.from("budget_lines").select("id", { count: "exact", head: true }).eq("brand_id", brandId);
  const { error } = await supabase
    .from("budget_lines")
    .insert(rows.map((r, i) => ({ ...r, brand_id: brandId, sort_order: (count ?? 0) + i + 1 })));
  if (error) return fail(error.message);
  refresh(brandId);
  return ok(`${rows.length} budget ${rows.length === 1 ? "line" : "lines"} added.${skipped.length ? ` ${skipped.length} row(s) skipped (no amount found).` : ""}`);
}

export async function deleteBudgetLine(lineId: string, brandId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("budget_lines").delete().eq("id", lineId);
  refresh(brandId);
}
