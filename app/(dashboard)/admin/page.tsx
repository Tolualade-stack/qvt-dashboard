import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole, type AuditEntry, type Brand, type Person } from "@/lib/types";
import { Badge, BrandStripe, Button, Card, PageTitle, SectionTitle } from "@/components/ui";
import { HistoryList } from "@/components/history-list";
import { setLeaveMode, setLoginActive } from "./actions";
import { CreateLoginForm, ResetPasswordForm } from "./forms";

export const metadata: Metadata = { title: "Admin · QVT Campaign Dashboard" };

type Profile = { user_id: string; person_id: string | null; email: string; app_role: AppRole; is_active: boolean };

export default async function AdminPage() {
  const me = await requireAdmin();
  const supabase = await createClient();

  const [{ data: brandRows }, { data: peopleRows }, { data: profileRows }, { data: historyRows }] = await Promise.all([
    supabase.from("brands").select("*").order("sort_order"),
    supabase.from("people").select("id, slug, full_name, is_placeholder").order("full_name"),
    supabase.from("profiles").select("user_id, person_id, email, app_role, is_active").order("email"),
    supabase.from("audit_log").select("*").order("changed_at", { ascending: false }).limit(15),
  ]);
  const brands = (brandRows ?? []) as Brand[];
  const people = (peopleRows ?? []) as Person[];
  const profiles = (profileRows ?? []) as Profile[];
  const nameOf = new Map(people.map((p) => [p.id, p.full_name]));

  // Team members who can be given a login: real people without one yet.
  const withLogin = new Set(profiles.map((p) => p.person_id));
  const available = people.filter((p) => !p.is_placeholder && !withLogin.has(p.id));

  return (
    <>
      <PageTitle subtitle="Leave Mode, logins and recent activity. Only you can see this page.">Admin</PageTitle>

      <div className="space-y-4">
        <Card>
          <SectionTitle>Leave Mode</SectionTitle>
          <p className="mb-3 text-sm text-slate-600">
            Switch on when you go on leave. The brand&apos;s leave cover can then edit that brand until you switch
            it off.
          </p>
          <ul className="space-y-3">
            {brands.map((brand) => (
              <li key={brand.id} className="rounded-lg border border-slate-200 p-3">
                <BrandStripe colour={brand.colour} />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{brand.name}</div>
                    <div className="text-sm text-slate-600">
                      Cover: {nameOf.get(brand.leave_cover_person_id ?? "") ?? "not set"}
                    </div>
                  </div>
                  <form action={setLeaveMode}>
                    <input type="hidden" name="brandId" value={brand.id} />
                    <input type="hidden" name="on" value={String(!brand.leave_mode_on)} />
                    <Button variant={brand.leave_mode_on ? "danger" : "secondary"}>
                      {brand.leave_mode_on ? "Turn off" : "Turn on"}
                    </Button>
                  </form>
                </div>
                <div className="mt-2">
                  {brand.leave_mode_on ? <Badge tone="amber">On: cover can edit</Badge> : <Badge>Off</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Logins</SectionTitle>
          <ul className="divide-y divide-slate-100">
            {profiles.map((profile) => (
              <li key={profile.user_id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{nameOf.get(profile.person_id ?? "") ?? profile.email}</span>
                  <Badge tone={profile.app_role === "admin" ? "green" : "grey"}>{ROLE_LABELS[profile.app_role]}</Badge>
                  {!profile.is_active && <Badge tone="red">Deactivated</Badge>}
                </div>
                <div className="text-sm text-slate-500">{profile.email}</div>
                {profile.user_id !== me.userId && (
                  <div className="mt-2 flex flex-wrap items-start gap-2">
                    <form action={setLoginActive}>
                      <input type="hidden" name="userId" value={profile.user_id} />
                      <input type="hidden" name="active" value={String(!profile.is_active)} />
                      <Button variant={profile.is_active ? "danger" : "secondary"}>
                        {profile.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </form>
                    <ResetPasswordForm userId={profile.user_id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Create a login</SectionTitle>
          <ul className="mb-3 space-y-1 text-sm text-slate-600">
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
              <li key={role}>
                <span className="font-medium text-slate-800">{ROLE_LABELS[role]}:</span> {ROLE_DESCRIPTIONS[role]}
              </li>
            ))}
          </ul>
          <CreateLoginForm people={available.map((p) => ({ id: p.id, name: p.full_name }))} />
        </Card>

        <Card>
          <SectionTitle>Recent activity</SectionTitle>
          <HistoryList entries={(historyRows ?? []) as AuditEntry[]} />
        </Card>
      </div>
    </>
  );
}
