import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { TIER_LABELS, type AuditEntry, type Brand, type BrandRole, type Person } from "@/lib/types";
import { Badge, BrandStripe, Card, PageTitle, SectionTitle } from "@/components/ui";
import { HistoryList } from "@/components/history-list";
import { CanvaLinkForm } from "./canva-link-form";

export default async function BrandPage({ params }: PageProps<"/brands/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const me = (await getCurrentUser())!;

  const [{ data: brandRow }, { data: roleRows }, { data: peopleRows }, { data: historyRows }] = await Promise.all([
    supabase.from("brands").select("*").eq("id", id).maybeSingle(),
    supabase.from("brand_roles").select("*").eq("brand_id", id).order("sort_order"),
    supabase.from("people").select("id, slug, full_name, is_placeholder"),
    supabase
      .from("audit_log")
      .select("*")
      .eq("table_name", "brands")
      .eq("row_id", id)
      .order("changed_at", { ascending: false })
      .limit(10),
  ]);
  if (!brandRow) notFound();

  const brand = brandRow as Brand;
  const roles = (roleRows ?? []) as BrandRole[];
  const people = new Map(((peopleRows ?? []) as Person[]).map((p) => [p.id, p]));
  const coverName = people.get(brand.leave_cover_person_id ?? "")?.full_name;

  // Group the jobs by person, in the order of their first job on this brand.
  const team = new Map<string, BrandRole[]>();
  for (const role of roles) team.set(role.person_id, [...(team.get(role.person_id) ?? []), role]);

  // Mirrors the database rule can_edit_brand(); the database still has the final say.
  const canEdit =
    me.role === "admin" ||
    me.role === "updates_manager" ||
    (me.role === "leave_cover" && brand.leave_mode_on && brand.leave_cover_person_id === me.personId);

  const target =
    brand.monthly_content_target_min != null
      ? `${brand.monthly_content_target_min}–${brand.monthly_content_target_max} pieces a month`
      : "No monthly target yet";

  return (
    <>
      <BrandStripe colour={brand.colour} />
      <div className="mt-3">
        <PageTitle subtitle={brand.scope}>{brand.name}</PageTitle>
      </div>

      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap gap-2">
            <Badge>{TIER_LABELS[brand.tier]}</Badge>
            {brand.leave_mode_on ? (
              <Badge tone="amber">Leave Mode on: {coverName} can edit</Badge>
            ) : (
              <Badge>Leave cover: {coverName ?? "not set"}</Badge>
            )}
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Reporting</dt>
              <dd className="text-right">{brand.reporting}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Content target</dt>
              <dd className="text-right">{target}</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <SectionTitle>Monthly Canva content calendar</SectionTitle>
          {brand.canva_calendar_url ? (
            <a
              href={brand.canva_calendar_url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm font-medium text-blue-700 underline"
            >
              Open this month&apos;s calendar in Canva
            </a>
          ) : (
            <p className="text-sm text-slate-500">No calendar linked yet.</p>
          )}
          {canEdit && <CanvaLinkForm brandId={brand.id} currentUrl={brand.canva_calendar_url ?? ""} />}
        </Card>

        <Card>
          <SectionTitle>Team</SectionTitle>
          <ul className="divide-y divide-slate-100">
            {[...team.entries()].map(([personId, jobs]) => {
              const person = people.get(personId);
              return (
                <li key={personId} className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{person?.full_name}</span>
                    {person?.is_placeholder && <Badge>Supporting role</Badge>}
                    {personId === brand.leave_cover_person_id && <Badge tone="amber">Leave cover</Badge>}
                  </div>
                  {jobs.map((job) => (
                    <div key={job.id} className="mt-1 text-sm">
                      <span className="text-slate-800">{job.title}</span>
                      {job.responsibilities && (
                        <span className="block text-slate-500">{job.responsibilities}</span>
                      )}
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <SectionTitle>History</SectionTitle>
          <HistoryList entries={(historyRows ?? []) as AuditEntry[]} />
        </Card>
      </div>
    </>
  );
}
