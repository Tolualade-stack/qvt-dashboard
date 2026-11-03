import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, greeting, longDate } from "@/lib/format";
import { TIER_LABELS, type Brand, type Person } from "@/lib/types";
import { Badge, LiveDot } from "@/components/ui";
import { PGlyph } from "@/components/prime-logo";

// Home: a welcome panel, the "Create a Dashboard" hero, then every brand as a
// "world" in its own colours. Phase 3 adds live numbers to the world cards.
export default async function HomePage() {
  const me = (await getCurrentUser())!;
  const supabase = await createClient();
  const [{ data: brandRows }, { data: roles }, { data: peopleRows }] = await Promise.all([
    supabase.from("brands").select("*").order("sort_order"),
    supabase.from("brand_roles").select("brand_id, person_id").is("ended_at", null),
    supabase.from("people").select("id, full_name"),
  ]);
  const brands = (brandRows ?? []) as Brand[];
  const nameOf = new Map(((peopleRows ?? []) as Pick<Person, "id" | "full_name">[]).map((p) => [p.id, p.full_name]));
  const teamSize = (brandId: string) =>
    new Set((roles ?? []).filter((r) => r.brand_id === brandId).map((r) => r.person_id)).size;
  const onLeave = brands.filter((b) => b.leave_mode_on).length;

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
          {onLeave > 0 && <span className="rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-white">Leave Mode on · {onLeave}</span>}
        </div>
      </section>

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
          <Link
            key={brand.id}
            href={`/brands/${brand.id}`}
            className="block overflow-hidden rounded-[26px] bg-white shadow-lg ring-1 ring-black/5 transition hover:-translate-y-0.5"
            style={{ boxShadow: `0 12px 30px ${brand.colour}2e` }}
          >
            <div className="relative h-28" style={{ background: `linear-gradient(135deg, ${brand.colour} 0%, #0b1f4b 120%)` }}>
              <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white">
                <LiveDot colour="#4ADE80" /> Updated {formatDateTime(brand.updated_at)}
              </span>
            </div>
            <div className="relative px-4 pb-4">
              <span
                className="absolute -top-8 left-4 flex size-16 items-center justify-center rounded-full bg-white font-display text-2xl font-black shadow-md"
                style={{ color: brand.colour }}
              >
                {brand.name.slice(0, 1)}
              </span>
              <div className="flex items-end justify-between gap-2 pt-10">
                <div>
                  <div className="text-xs font-semibold tracking-wider" style={{ color: brand.colour }}>THE WORLD OF</div>
                  <div className="font-display text-2xl font-black leading-none">{brand.name}</div>
                </div>
                <Badge>{TIER_LABELS[brand.tier]}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <span>{teamSize(brand.id)} people</span>
                <span>{brand.reporting}</span>
              </div>
              {brand.leave_mode_on && (
                <div className="mt-3">
                  <Badge tone="amber">Leave Mode on: {nameOf.get(brand.leave_cover_person_id ?? "") ?? "cover"} can edit</Badge>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
