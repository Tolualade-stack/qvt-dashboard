"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type FormState } from "@/lib/form-state";
import { METRIC_FIELDS } from "@/lib/metrics";

// Saves one channel's numbers for a period. Empty boxes stay empty (not zero),
// so a channel that has no "likes" never shows a misleading 0.
export async function addNumbers(brandId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const channel = String(formData.get("channel") ?? "");
  const start = String(formData.get("period_start") ?? "");
  const end = String(formData.get("period_end") ?? "");
  if (!channel) return fail("Choose the channel.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return fail("Choose the dates the numbers cover.");
  if (end < start) return fail("The end date is before the start date.");

  const read = (name: string) => {
    const raw = String(formData.get(name) ?? "").replace(/[,\s]/g, "");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.round(n) : NaN;
  };
  const values: Record<string, number | null> = {};
  for (const [field] of [...METRIC_FIELDS, ["spots_aired", "Spots aired"] as const]) {
    const v = read(field);
    if (Number.isNaN(v)) return fail("Use numbers only, e.g. 48300.");
    values[field] = v;
  }
  if (Object.values(values).every((v) => v === null)) return fail("Enter at least one number.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("channel_metrics")
    .insert({ brand_id: brandId, channel, period_start: start, period_end: end, source: "manual", ...values })
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail("You don't have permission to update this brand right now.");

  revalidatePath(`/brands/${brandId}`, "layout");
  revalidatePath("/");
  return ok("Numbers saved. The world's tiles update straight away.");
}

// The weekly spend update. The database checks, line by line, that this person
// covers ads or numbers for it, and only ever changes the spend.
export async function saveSpend(brandId: string, lines: { id: string; spent: string }[]): Promise<{ ok: boolean; message: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_spend", { p_lines: lines });
  if (error) return { ok: false, message: error.message };
  const saved = Number(data ?? 0);
  if (saved === 0) return { ok: false, message: "You can't update spend here. It may be someone else's area." };
  await supabase.from("update_notes").insert({ brand_id: brandId, note: `Weekly spend updated on ${saved} media plan ${saved === 1 ? "line" : "lines"}.` });
  revalidatePath(`/brands/${brandId}`, "layout");
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: saved < lines.length ? `${saved} saved. ${lines.length - saved} belong to someone else's area and weren't changed.` : "Spend saved. The budget spread is up to date.",
  };
}
