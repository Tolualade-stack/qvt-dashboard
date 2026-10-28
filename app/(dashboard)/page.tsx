import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { TIER_LABELS, type Brand, type Person } from "@/lib/types";
import { Badge, BrandStripe, Card, PageTitle } from "@/components/ui";

// Home screen. In Phase 1 it lists the brands and their teams; Phase 3 turns
// these cards into the live overview (posted vs planned, live ads, overdue items).
export default async function BrandsPage() {
  const supabase = await createClient();
  const [{ data: brandRows }, { data: roles }, { data: peopleRows }] = await Promise.all([
    supabase.from("brands").select("*").order("sort_order"),
    supabase.from("brand_roles").select("brand_id, person_id"),
    supabase.from("people").select("id, full_name"),
  ]);
  const brands = (brandRows ?? []) as Brand[];
  const people = (peopleRows ?? []) as Pick<Person, "id" | "full_name">[];

  const nameOf = new Map(people.map((p) => [p.id, p.full_name]));
  const teamSize = (brandId: string) =>
    new Set((roles ?? []).filter((r) => r.brand_id === brandId).map((r) => r.person_id)).size;

  return (
    <>
      <PageTitle subtitle="Tap a brand to see its team and details.">Brands</PageTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {brands.map((brand) => (
          <Link key={brand.id} href={`/brands/${brand.id}`} className="block">
            <Card className="h-full transition hover:border-slate-400">
              <BrandStripe colour={brand.colour} />
              <div className="mt-3 flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold">{brand.name}</h2>
                <Badge>{TIER_LABELS[brand.tier]}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-600">{brand.scope}</p>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Reporting</dt>
                  <dd className="text-right">{brand.reporting}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Team</dt>
                  <dd>{teamSize(brand.id)} people</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Last updated</dt>
                  <dd>{formatDateTime(brand.updated_at)}</dd>
                </div>
              </dl>
              {brand.leave_mode_on && (
                <div className="mt-3">
                  <Badge tone="amber">
                    Leave Mode on: {nameOf.get(brand.leave_cover_person_id ?? "") ?? "cover"} can edit
                  </Badge>
                </div>
              )}
            </Card>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-500">
        Content, ads, reports and the update log arrive in Phase 2.
      </p>
    </>
  );
}
