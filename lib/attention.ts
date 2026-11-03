import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { computeFlags, type Flag, type TeamMember } from "@/lib/flags";
import type { Brand } from "@/lib/types";
import type { ContentItem } from "@/lib/content";
import type { Ad, FundRequest } from "@/lib/ads";
import type { Report } from "@/lib/reports";

type Client = Awaited<ReturnType<typeof createClient>>;

// Loads everything the flags need for the given brands, in one round trip, and
// returns each brand's flags (most urgent first).
export async function loadFlags(supabase: Client, brands: Brand[], now = Date.now()): Promise<Map<string, Flag[]>> {
  const ids = brands.map((b) => b.id);
  const result = new Map<string, Flag[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return result;

  await supabase.rpc("ensure_reports");
  const [content, ads, funds, reports, team, notes, metrics] = await Promise.all([
    supabase.from("content_items").select("*").in("brand_id", ids).eq("is_archived", false),
    supabase.from("ads").select("*").in("brand_id", ids).eq("is_archived", false),
    supabase.from("fund_requests").select("*").in("brand_id", ids).eq("status", "pending"),
    supabase.from("reports").select("*").in("brand_id", ids).is("sent_at", null),
    supabase.from("brand_roles").select("brand_id, person_id, role_key, title, people(full_name)").in("brand_id", ids).is("ended_at", null),
    supabase.from("update_notes").select("brand_id, created_at").in("brand_id", ids).order("created_at", { ascending: false }).limit(200),
    supabase.from("channel_metrics").select("brand_id, created_at").in("brand_id", ids).order("created_at", { ascending: false }).limit(200),
  ]);

  const rows = <T,>(r: { data: unknown }) => (r.data ?? []) as T[];
  const allContent = rows<ContentItem>(content);
  const allAds = rows<Ad>(ads);

  for (const brand of brands) {
    const mine = <T extends { brand_id: string }>(list: T[]) => list.filter((x) => x.brand_id === brand.id);
    const brandTeam: TeamMember[] = rows<{ brand_id: string; person_id: string; role_key: string; title: string; people: unknown }>(team)
      .filter((t) => t.brand_id === brand.id)
      .map((t) => ({
        personId: t.person_id,
        name: (t.people as { full_name: string } | null)?.full_name ?? "Someone",
        roleKey: t.role_key,
        title: t.title,
      }));

    // The most recent thing recorded on this world, for the 24-hour no-update flag.
    const times = [
      brand.updated_at,
      ...mine(allContent).map((c) => c.updated_at),
      ...mine(allAds).map((a) => (a as Ad & { updated_at?: string }).updated_at ?? a.status_changed_at),
      ...mine(rows<{ brand_id: string; created_at: string }>(notes)).map((n) => n.created_at),
      ...mine(rows<{ brand_id: string; created_at: string }>(metrics)).map((m) => m.created_at),
    ].filter(Boolean);
    const lastActivity = times.sort().at(-1) ?? null;

    result.set(
      brand.id,
      computeFlags({
        brand,
        team: brandTeam,
        content: mine(allContent),
        ads: mine(allAds),
        funds: mine(rows<FundRequest>(funds)),
        reports: mine(rows<Report>(reports)),
        lastActivity,
        now,
      }),
    );
  }
  return result;
}
