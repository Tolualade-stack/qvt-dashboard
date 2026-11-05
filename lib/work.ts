import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/auth";
import { buildWork, lagosDay, CHECK_IN_NOTE, type WorkInput } from "@/lib/work-items";

type Client = Awaited<ReturnType<typeof createClient>>;

// Loads one person's open work. An Admin sees everything, unless viewing as a
// particular team member.
export async function loadMyWork(supabase: Client, me: CurrentUser, asPersonId?: string | null) {
  await supabase.rpc("ensure_reports");
  const [brands, campaigns, areas, team, people, content, ads, funds, reports, assets, deliverables, issues, metrics] = await Promise.all([
    supabase.from("brands").select("id, name, colour, leave_mode_on, leave_cover_person_id").eq("is_archived", false),
    supabase.from("campaigns").select("id, brand_id, name, status, account_lead_person_id, creative_assets_target, track_assets, track_numbers, channels, is_archived"),
    supabase.from("campaign_areas").select("campaign_id, area, person_id"),
    supabase.from("campaign_team").select("campaign_id, person_id"),
    supabase.from("people").select("id, full_name"),
    supabase.from("content_items").select("*").eq("is_archived", false).neq("status", "posted"),
    supabase.from("ads").select("*").eq("is_archived", false).neq("status", "ended"),
    supabase.from("fund_requests").select("ad_id").eq("status", "pending"),
    supabase.from("reports").select("*").is("sent_at", null),
    supabase.from("creative_assets").select("status, campaign_id").eq("is_archived", false).not("campaign_id", "is", null),
    supabase.from("campaign_deliverables").select("*").eq("is_archived", false),
    supabase.from("work_issues").select("*").is("resolved_at", null),
    supabase.from("channel_metrics").select("brand_id, period_end").order("period_end", { ascending: false }).limit(500),
  ]);

  const lastNumbers: Record<string, string | null> = {};
  for (const m of metrics.data ?? []) lastNumbers[m.brand_id] ??= m.period_end;

  const viewing = asPersonId || null;
  const input: WorkInput = {
    personId: viewing ?? me.personId,
    seesAll: me.role === "admin" && !viewing,
    brands: brands.data ?? [],
    campaigns: (campaigns.data ?? []) as WorkInput["campaigns"],
    areas: (areas.data ?? []) as WorkInput["areas"],
    people: people.data ?? [],
    content: (content.data ?? []) as WorkInput["content"],
    ads: (ads.data ?? []) as WorkInput["ads"],
    fundsPendingAds: (funds.data ?? []).map((f) => f.ad_id).filter(Boolean) as string[],
    reports: (reports.data ?? []) as WorkInput["reports"],
    assets: (assets.data ?? []) as WorkInput["assets"],
    deliverables: (deliverables.data ?? []) as WorkInput["deliverables"],
    issues: (issues.data ?? []) as WorkInput["issues"],
    lastNumbers,
  };

  // Everyone on a live campaign, for the Admin's "view as" pills.
  const liveIds = new Set(input.campaigns.filter((c) => c.status === "live" && !c.is_archived).map((c) => c.id));
  const managerIds = new Set((team.data ?? []).filter((t) => liveIds.has(t.campaign_id)).map((t) => t.person_id as string));
  const managers = input.people.filter((p) => managerIds.has(p.id));

  // Who covers each area of campaigns this person is on, to explain work that isn't theirs.
  const myCampaigns = new Set((team.data ?? []).filter((t) => t.person_id === me.personId).map((t) => t.campaign_id));
  const elsewhere = input.areas
    .filter((a) => myCampaigns.has(a.campaign_id) && a.person_id !== me.personId)
    .map((a) => ({ area: a.area, name: input.people.find((p) => p.id === a.person_id)?.full_name ?? "someone else" }));

  return { items: buildWork(input), brands: input.brands, managers, elsewhere };
}

// Has this person already checked in today on these brands?
export async function checkedInToday(supabase: Client, me: CurrentUser, now: number) {
  const startOfDay = new Date(new Date(`${lagosDay(now)}T00:00:00Z`).getTime() - 3_600_000).toISOString();
  const { count } = await supabase
    .from("update_notes")
    .select("id", { count: "exact", head: true })
    .eq("created_by", me.userId)
    .eq("note", CHECK_IN_NOTE)
    .gte("created_at", startOfDay);
  return (count ?? 0) > 0;
}
