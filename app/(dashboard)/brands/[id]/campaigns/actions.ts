"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftDeliverables, type CampaignFields, type CampaignPayload } from "@/lib/campaign-setup";
import { MARKETING_TYPES, labelFor } from "@/lib/campaign";

// Campaign setup. Admin only; the database checks this again.

function refresh(brandId: string) {
  revalidatePath(`/brands/${brandId}`, "layout");
  revalidatePath("/", "layout");
}

// The brand-level settings the World page, report schedule and flags read.
async function syncBrand(supabase: Awaited<ReturnType<typeof createClient>>, fields: CampaignFields) {
  const { data: brand } = await supabase.from("brands").select("channels, marketing_types").eq("id", fields.brand_id).single();
  if (!brand) return;
  const types = [...new Set([...brand.marketing_types, ...fields.marketing_types])];
  await supabase
    .from("brands")
    .update({
      channels: [...new Set([...brand.channels, ...fields.channels])],
      marketing_types: types,
      scope: types.map((t) => labelFor(MARKETING_TYPES, t)).join(" + ") || "Campaign scope not set yet.",
      tier: fields.tier,
      in_execution_cycle: fields.in_monthly_cycle,
      ...(fields.reporting ? { reporting: fields.reporting } : {}),
      ...(fields.content_target_min != null ? { monthly_content_target_min: fields.content_target_min, monthly_content_target_max: fields.content_target_max ?? fields.content_target_min } : {}),
      ...(fields.creative_assets_target != null ? { creative_assets_target: fields.creative_assets_target } : {}),
      ...(fields.leave_cover_person_id ? { leave_cover_person_id: fields.leave_cover_person_id } : {}),
      ...(fields.quantities.tv != null ? { tv_spots_target: fields.quantities.tv } : {}),
      ...(fields.quantities.radio != null ? { radio_spots_target: fields.quantities.radio } : {}),
    })
    .eq("id", fields.brand_id);
}

const problem = (fields: CampaignFields) => {
  if (fields.name.trim().length < 2) return "Give the campaign a name.";
  if (fields.start_date && fields.end_date && fields.end_date < fields.start_date) return "The end date is before the start date.";
  if (fields.team.length > 3) return "A campaign can have up to 3 Update Managers.";
  return null;
};

export async function launchCampaign(payload: CampaignPayload): Promise<{ ok: boolean; message: string; id?: string }> {
  await requireAdmin();
  const wrong = problem(payload);
  if (wrong) return { ok: false, message: wrong };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("launch_campaign", { p: payload });
  if (error) return { ok: false, message: error.message };
  await syncBrand(supabase, payload);
  refresh(payload.brand_id);
  return { ok: true, message: "Campaign launched.", id: data as string };
}

// Changes a campaign's details and team. Its tracked work stays; a newly ticked
// item (say Radio) is added, and changed "how many" figures are updated.
export async function saveCampaign(campaignId: string, fields: CampaignFields): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const wrong = problem(fields);
  if (wrong) return { ok: false, message: wrong };
  const supabase = await createClient();

  const { error } = await supabase
    .from("campaigns")
    .update({
      name: fields.name.trim(),
      objective: fields.objective,
      start_date: fields.start_date,
      end_date: fields.end_date,
      kpis: fields.kpis,
      marketing_types: fields.marketing_types,
      channels: fields.channels,
      selections: fields.selections,
      quantities: fields.quantities,
      content_target_min: fields.content_target_min,
      content_target_max: fields.content_target_max,
      creative_assets_target: fields.creative_assets_target,
      reporting: fields.reporting,
      tier: fields.tier,
      in_monthly_cycle: fields.in_monthly_cycle,
      media_plan_url: fields.media_plan_url,
      media_plan_path: fields.media_plan_path,
      strategy_url: fields.strategy_url,
      strategy_path: fields.strategy_path,
      account_lead_person_id: fields.account_lead_person_id,
      leave_cover_person_id: fields.leave_cover_person_id,
      email_alerts: fields.email_alerts,
    })
    .eq("id", campaignId);
  if (error) return { ok: false, message: error.message };

  // Team and areas: replace with what's on screen.
  await supabase.from("campaign_team").delete().eq("campaign_id", campaignId);
  await supabase.from("campaign_areas").delete().eq("campaign_id", campaignId);
  if (fields.team.length) {
    const { error: teamError } = await supabase.from("campaign_team").insert(fields.team.map((person_id) => ({ campaign_id: campaignId, person_id })));
    if (teamError) return { ok: false, message: teamError.message };
  }
  if (fields.areas.length) {
    const { error: areaError } = await supabase.from("campaign_areas").insert(fields.areas.map((a) => ({ campaign_id: campaignId, area: a.area, person_id: a.person_id })));
    if (areaError) return { ok: false, message: areaError.message };
  }

  // Counted work: add new items and update how many are planned.
  const quantities = Object.fromEntries(Object.entries(fields.quantities).map(([k, v]) => [k, v == null ? "" : String(v)]));
  const drafts = draftDeliverables(fields.marketing_types, fields.selections, quantities);
  if (drafts.length) {
    const { error: workError } = await supabase
      .from("campaign_deliverables")
      .upsert(drafts.map((d) => ({ ...d, campaign_id: campaignId, brand_id: fields.brand_id, is_archived: false })), { onConflict: "campaign_id,group_id" });
    if (workError) return { ok: false, message: workError.message };
  }

  await syncBrand(supabase, fields);

  refresh(fields.brand_id);
  return { ok: true, message: "Saved." };
}

export type ManagerResult = {
  ok: boolean;
  message: string;
  person?: { id: string; name: string; email: string | null; hasLogin: boolean };
  tempPassword?: string;
};

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "person";

// Adds someone as a team member with a login, or gives an existing team member a
// login. PRIME can't send email yet, so this returns a temporary password for
// the Account Lead to hand over once. They change it under "My account".
export async function addManagerLogin(input: { personId?: string; name?: string; email: string }): Promise<ManagerResult> {
  await requireAdmin();
  const email = input.email.trim().toLowerCase();
  const name = input.name?.trim() ?? "";
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, message: "Enter a valid email address." };
  if (!input.personId && name.length < 2) return { ok: false, message: "Enter their name." };

  const supabase = await createClient();
  let personId = input.personId ?? null;
  let personName = name;
  let createdPerson = false;

  if (personId) {
    const { data: person } = await supabase.from("people").select("full_name").eq("id", personId).single();
    if (!person) return { ok: false, message: "That team member no longer exists." };
    personName = person.full_name;
  } else {
    const { data: workspace } = await supabase.from("workspaces").select("id").order("sort_order").limit(1).single();
    let slug = slugify(name);
    const { count } = await supabase.from("people").select("id", { count: "exact", head: true }).eq("slug", slug);
    if (count) slug = `${slug}-${randomBytes(2).toString("hex")}`;
    const { data: person, error } = await supabase
      .from("people")
      .insert({ full_name: name, slug, email, workspace_id: workspace?.id })
      .select("id")
      .single();
    if (error || !person) return { ok: false, message: error?.message ?? "Couldn't add them." };
    personId = person.id as string;
    createdPerson = true;
  }

  // Readable but strong; shown once and never stored in PRIME.
  const tempPassword = `Prime-${randomBytes(6).toString("base64url")}`;
  const admin = createAdminClient();
  const undoPerson = async () => {
    if (createdPerson) await supabase.from("people").delete().eq("id", personId!);
  };
  const { data: created, error: authError } = await admin.auth.admin.createUser({ email, password: tempPassword, email_confirm: true });
  if (authError || !created.user) {
    await undoPerson();
    return { ok: false, message: authError?.message.includes("already") ? "That email already has a login." : (authError?.message ?? "Couldn't create the login.") };
  }
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ user_id: created.user.id, person_id: personId, email, app_role: "updates_manager" });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    await undoPerson();
    return { ok: false, message: profileError.message.includes("person_id") ? "That team member already has a login." : profileError.message };
  }
  await supabase.from("people").update({ email }).eq("id", personId);

  revalidatePath("/admin");
  revalidatePath("/team");
  return { ok: true, message: `Login created for ${personName}.`, person: { id: personId!, name: personName, email, hasLogin: true }, tempPassword };
}

// Ends a campaign or brings it back. Its work and history are kept.
export async function setCampaignStatus(campaignId: string, brandId: string, status: "live" | "ended") {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").update({ status }).eq("id", campaignId);
  if (error) throw new Error(error.message);
  refresh(brandId);
}

// Corrects a counted item's planned and done figures. Whoever covers its area
// can do this (the database checks).
export async function fixDeliverable(id: string, brandId: string, planned: string, done: string): Promise<{ ok: boolean; message: string }> {
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[,\s]/g, "")));
  const plan = num(planned);
  const count = num(done);
  if ((plan !== null && !(plan >= 0)) || count === null || !(count >= 0)) return { ok: false, message: "Use whole numbers, e.g. 12." };
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_deliverables")
    .update({ planned_qty: plan === null ? null : Math.round(plan), done_qty: Math.round(count) })
    .eq("id", id)
    .select("id");
  if (!data?.length) return { ok: false, message: "You can't change this. It may be someone else's area." };
  refresh(brandId);
  return { ok: true, message: "Saved." };
}
