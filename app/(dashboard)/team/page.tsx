import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { Brand, BrandRole, CatalogueRole, Person } from "@/lib/types";
import { Badge, Button, Card, PageTitle, SectionTitle } from "@/components/ui";
import { endAssignment, setPersonActive } from "./actions";
import { AddPersonForm, AssignForm } from "./forms";

export const metadata: Metadata = { title: "Team · PRIME" };

// Everyone in the workspace and what they do on each brand. People move between
// brands; moving someone off keeps the old job as history.
export default async function TeamPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: peopleRows }, { data: roleRows }, { data: brandRows }, { data: catalogueRows }] = await Promise.all([
    supabase.from("people").select("*").order("is_placeholder").order("full_name"),
    supabase.from("brand_roles").select("*").order("sort_order"),
    supabase.from("brands").select("*").order("sort_order"),
    supabase.from("role_catalogue").select("*").eq("is_active", true).order("sort_order"),
  ]);
  const people = (peopleRows ?? []) as Person[];
  const assignments = (roleRows ?? []) as BrandRole[];
  const brands = (brandRows ?? []) as Brand[];
  const catalogue = (catalogueRows ?? []) as CatalogueRole[];
  const brandOf = new Map(brands.map((b) => [b.id, b]));

  const brandOptions = brands.filter((b) => !b.is_archived).map((b) => ({ id: b.id, name: b.name }));
  const roleOptions = catalogue.map((r) => ({ id: r.id, name: r.name }));

  return (
    <>
      <Link href="/admin" className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        Admin
      </Link>
      <PageTitle subtitle="Add people, put them on brands, and move them when projects change. One person can hold several roles.">
        Team
      </PageTitle>

      <div className="space-y-4">
        <Link href="/team/roles" className="flex items-center justify-between rounded-3xl bg-mist p-5 transition hover:bg-line">
          <span>
            <span className="block font-display text-lg font-black">Role catalogue</span>
            <span className="block text-sm text-muted">{catalogue.length} standard roles · add your own</span>
          </span>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
        </Link>

        <Card>
          <SectionTitle>Add a team member</SectionTitle>
          <AddPersonForm />
        </Card>

        {people.map((person) => {
          const mine = assignments.filter((a) => a.person_id === person.id);
          const current = mine.filter((a) => !a.ended_at);
          const past = mine.filter((a) => a.ended_at);
          return (
            <Card key={person.id} className={person.is_active ? "" : "opacity-60"}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-ink font-display text-lg font-black text-white">
                    {person.full_name.slice(0, 1)}
                  </span>
                  <div>
                    <div className="font-display text-lg font-black leading-tight">{person.full_name}</div>
                    <div className="text-xs text-muted">
                      {current.length} {current.length === 1 ? "role" : "roles"} now
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {person.is_placeholder && <Badge>Supporting role</Badge>}
                  {!person.is_active && <Badge tone="red">Inactive</Badge>}
                </div>
              </div>

              {current.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {current.map((a) => {
                    const brand = brandOf.get(a.brand_id);
                    return (
                      <li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line p-3">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: brand?.colour }} />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold">{a.title}</span>
                            <span className="block text-xs text-muted">{brand?.name}</span>
                          </span>
                        </span>
                        <form action={endAssignment}>
                          <input type="hidden" name="assignmentId" value={a.id} />
                          <Button variant="secondary" className="min-h-9 px-3 text-xs">Move off</Button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}

              {past.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-semibold text-muted">Previously ({past.length})</summary>
                  <ul className="mt-2 space-y-1 text-muted">
                    {past.map((a) => (
                      <li key={a.id}>
                        {a.title} on {brandOf.get(a.brand_id)?.name} · until {formatDateTime(a.ended_at!)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="mt-4 flex flex-wrap items-start gap-2">
                {person.is_active && <AssignForm personId={person.id} brands={brandOptions} roles={roleOptions} />}
                <form action={setPersonActive}>
                  <input type="hidden" name="personId" value={person.id} />
                  <input type="hidden" name="active" value={String(!person.is_active)} />
                  <Button variant={person.is_active ? "danger" : "secondary"} className="min-h-10">
                    {person.is_active ? "Mark inactive" : "Reactivate"}
                  </Button>
                </form>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
