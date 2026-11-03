import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_KEY_LABELS, type BrandRole, type CatalogueRole } from "@/lib/types";
import { Badge, Button, Card, PageTitle, SectionTitle } from "@/components/ui";
import { setRoleActive } from "../actions";
import { AddRoleForm } from "../forms";

export const metadata: Metadata = { title: "Role catalogue · PRIME" };

// The workspace's standard roles. Retiring a role hides it from new assignments
// but keeps it on anyone who already holds it.
export default async function RolesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: catalogueRows }, { data: assignmentRows }] = await Promise.all([
    supabase.from("role_catalogue").select("*").order("sort_order"),
    supabase.from("brand_roles").select("role_id, ended_at").is("ended_at", null),
  ]);
  const catalogue = (catalogueRows ?? []) as CatalogueRole[];
  const inUse = (id: string) => ((assignmentRows ?? []) as Pick<BrandRole, "role_id">[]).filter((a) => a.role_id === id).length;

  return (
    <>
      <Link href="/team" className="mb-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        Team
      </Link>
      <PageTitle subtitle="The standard roles your campaigns use. Add new ones as they come up.">Role catalogue</PageTitle>

      <div className="space-y-4">
        <Card>
          <SectionTitle>Add a role</SectionTitle>
          <AddRoleForm />
        </Card>

        <Card>
          <ul className="divide-y divide-line">
            {catalogue.map((role) => (
              <li key={role.id} className={`flex items-start justify-between gap-3 py-3 ${role.is_active ? "" : "opacity-60"}`}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{role.name}</span>
                    <Badge>{ROLE_KEY_LABELS[role.role_key]}</Badge>
                    {!role.is_active && <Badge tone="red">Retired</Badge>}
                  </div>
                  {role.description && <div className="mt-0.5 text-sm text-muted">{role.description}</div>}
                  <div className="mt-0.5 text-xs text-muted">{inUse(role.id)} people in this role now</div>
                </div>
                <form action={setRoleActive}>
                  <input type="hidden" name="roleId" value={role.id} />
                  <input type="hidden" name="active" value={String(!role.is_active)} />
                  <Button variant="secondary" className="min-h-9 px-3 text-xs">{role.is_active ? "Retire" : "Bring back"}</Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
