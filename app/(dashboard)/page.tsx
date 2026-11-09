import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { greeting, longDate } from "@/lib/format";
import type { Brand, Person } from "@/lib/types";
import { monthCounts, type ContentItem } from "@/lib/content";
import type { Ad } from "@/lib/ads";
import { compact, summarise, type ChannelMetric } from "@/lib/metrics";
import { loadFlags } from "@/lib/attention";
import { LiveDot } from "@/components/ui";
import { PGlyph } from "@/components/prime-logo";
import { WorldCard } from "@/components/world-card";

// Home: a welcome panel, the "Create a Dashboard" hero, then every brand as a
// "world" in its own colours. Phase 3 adds live numbers to the world cards.
export default async function HomePage() {
  const me = (await getCurrentUser())!;
  const supabase = await createClient();
  const [{ data: brandRows }, { data: peopleRows }, { data: contentRows }, { data: adRows }, { data: metricRows }] = await Promise.all([
    supabase.from("brands").select("*").eq("is_archived", false).order("sort_order"),
    supabase.from("people").select("id, full_name"),
    supabase.from("content_items").select("brand_id, status, planned_date, posted_at, is_archived"),
    supabase.from("ads").select("brand_id, status").eq("is_archived", false),
    supabase.from("channel_metrics").select("*"),
  ]);
  const brands = (brandRows ?? []) as Brand[];
  const nameOf = new Map(((peopleRows ?? []) as Pick<Person, "id" | "full_name">[]).map((p) => [p.id, p.full_name]));
  const onLeave = brands.filter((b) => b.leave_mode_on).length;
  const flags = await loadFlags(supabase, brands);

  const metrics = (metricRows ?? []) as ChannelMetric[];
  const reachOf = (brandId: string) => {
    const reach = summarise(metrics.filter((m) => m.brand_id === brandId), null).values.reach;
    return reach !== undefined ? compact(reach) : null;
  };
  const content = (contentRows ?? []) as ContentItem[];
  const ads = (adRows ?? []) as Pick<Ad, "brand_id" | "status">[];
  const postedThisMonth = (brandId: string) => monthCounts(content.filter((c) => c.brand_id === brandId)).posted;
  const adsLive = (brandId: string) => ads.filter((a) => a.brand_id === brandId && a.status === "live").length;

  // What needs attention: the banner, the "need you" chip, and each card's pill.
  const allFlags = [...flags.values()].flat();
  const needYou = allFlags.filter((f) => f.severity !== "warning").length;
  const flagFor = (brand: Brand): string | null => {
    const list = flags.get(brand.id) ?? [];
    const toEscalate = list.filter((f) => f.severity === "critical").length;
    const overdue = list.filter((f) => f.severity === "overdue").length;
    if (toEscalate) return `${toEscalate} to escalate`;
    if (overdue) return `${overdue} overdue`;
    if (list.length) return list[0].title.length > 26 ? `${list.length} heads up` : list[0].title;
    if (brand.leave_mode_on) return `Leave Mode: ${nameOf.get(brand.leave_cover_person_id ?? "") ?? "cover"}`;
    return null;
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-mist p-5">
        <div className="text-sm text-muted">{longDate(new Date())}</div>
        <h1 className="mt-1 font-display text-[34px] font-black leading-none tracking-tight text-navy">
          {greeting(new Date())}, {me.name}.
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold">
            <LiveDot /> {brands.length} worlds live
          </span>
          {needYou > 0 && (
            <Link href="/attention" className="rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-white">
              {needYou} need you
            </Link>
          )}
          {onLeave > 0 && <span className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold">Leave Mode on · {onLeave}</span>}
        </div>
      </section>

      <Link href="/work" className="prime-gradient flex min-h-[72px] items-center gap-3 rounded-[22px] p-4 text-white transition hover:brightness-125">
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-black">My work</span>
          <span className="block text-[13px] text-[#DCE4F7]">Everything open for you, soonest first.</span>
        </span>
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="shrink-0"><path d="m9 6 6 6-6 6" /></svg>
      </Link>

      {allFlags.length > 0 && (
        <Link href="/attention" className="flex items-center gap-3 rounded-[20px] bg-[#FFF1E0] p-4 text-[#7A3E00] transition hover:brightness-95">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M12 3 2 21h20L12 3z" /><path d="M12 10v4" /><path d="M12 17.5v.5" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold">
              {allFlags.length} {allFlags.length === 1 ? "item needs" : "items need"} attention
            </span>
            <span className="block text-[13px] opacity-90">
              {brands
                .filter((b) => (flags.get(b.id) ?? []).length)
                .map((b) => `${(flags.get(b.id) ?? []).length} on ${b.name}`)
                .join(" · ")}
            </span>
          </span>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0"><path d="m9 6 6 6-6 6" /></svg>
        </Link>
      )}

      {me.role === "admin" && (
        <Link
          href="/worlds/new"
          className="prime-gradient relative block min-h-[290px] overflow-hidden rounded-[30px] text-white shadow-2xl shadow-navy/30 transition hover:brightness-110"
        >
          <span aria-hidden="true" className="prime-float absolute -top-8 -right-16 opacity-15">
            <PGlyph size={250} colour="#FFFFFF" />
          </span>
          <span
            aria-hidden="true"
            className="absolute -bottom-32 -left-20 size-[300px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(76,125,255,0.35) 0%, rgba(0,0,0,0) 70%)" }}
          />
          <span className="relative flex min-h-[290px] flex-col gap-4 p-6">
            <span className="text-xs font-semibold tracking-[0.2em] text-[#AFC3EE]">NEW</span>
            <span className="relative block h-[100px] font-display text-[42px] font-black leading-none tracking-tight">
              <span className="prime-swap-a absolute inset-0">Create a<br />Dashboard</span>
              <span className="prime-swap-b absolute inset-0 text-[#DCE6FF]" aria-hidden="true">Build your<br />brand&apos;s world</span>
            </span>
            <span className="max-w-60 text-sm text-[#C9D6F5]">Name it, drop in the logo and banner. PRIME picks up the brand&apos;s colours.</span>
            <span aria-hidden="true" className="prime-pulse mt-auto flex size-14 items-center justify-center rounded-full bg-white text-navy">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
          </span>
        </Link>
      )}

      <div className="flex items-baseline justify-between pt-2">
        <h2 className="font-display text-2xl font-black text-navy">Your worlds</h2>
        <span className="text-sm font-semibold text-muted">{brands.length} brands</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {brands.map((brand) => (
          <WorldCard
            key={brand.id}
            brand={brand}
            stats={{ posted: postedThisMonth(brand.id), adsLive: adsLive(brand.id), reach: reachOf(brand.id) }}
            flag={flagFor(brand)}
          />
        ))}
      </div>
    </div>
  );
}
