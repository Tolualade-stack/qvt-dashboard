import { DeleteWorldForm } from "./delete-world-form";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole, type AuditEntry, type Brand, type Person, type Workspace } from "@/lib/types";
import { Badge, BrandStripe, Button, Card, PageTitle, SectionTitle } from "@/components/ui";
import { HistoryList } from "@/components/history-list";
import { setBrandArchived, setLeaveMode, setLoginActive } from "./actions";
import { AddWorkspaceForm, CreateLoginForm, ResetPasswordForm } from "./forms";

export const metadata: Metadata = { title: "Admin · PRIME" };

type Profile = { user_id: string; person_id: string | null; email: string; app_role: AppRole; is_active: boolean };

export default async function AdminPage() {
  const me = await requireAdmin();
  const supabase = await createClient();

  const [{ data: brandRows }, { data: peopleRows }, { data: profileRows }, { data: historyRows }, { data: workspaceRows }] = await Promise.all([
    supabase.from("brands").select("*").order("sort_order"),
    supabase.from("people").select("id, slug, full_name, is_placeholder").order("full_name"),
    supabase.from("profiles").select("user_id, person_id, email, app_role, is_active").order("email"),
    supabase.from("audit_log").select("*").order("changed_at", { ascending: false }).limit(15),
    supabase.from("workspaces").select("id, slug, name, description").order("sort_order"),
  ]);
  const workspaces = (workspaceRows ?? []) as Workspace[];
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
        <Link href="/team" className="prime-gradient flex items-center justify-between rounded-3xl p-5 text-white transition hover:brightness-110">
          <span>
            <span className="block font-display text-xl font-black">Team</span>
            <span className="block text-sm text-[#C9D6F5]">People, who does what on each brand, and the role catalogue</span>
          </span>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
        </Link>

        <Card>
          <SectionTitle>Workspaces</SectionTitle>
          <p className="mb-3 text-sm text-muted">Each company using PRIME is a workspace, with its own brands and team.</p>
          <ul className="mb-4 space-y-2">
            {workspaces.map((ws) => (
              <li key={ws.id} className="flex items-center gap-3 rounded-2xl bg-mist p-3">
                <span className="prime-gradient flex size-10 items-center justify-center rounded-xl font-display text-lg font-black text-white">
                  {ws.name.slice(0, 1)}
                </span>
                <span>
                  <span className="block font-semibold">{ws.name}</span>
                  {ws.description && <span className="block text-sm text-muted">{ws.description}</span>}
                </span>
              </li>
            ))}
          </ul>
          <AddWorkspaceForm />
        </Card>

        <Card>
          <SectionTitle>Brands &amp; Leave Mode</SectionTitle>
          <p className="mb-3 text-sm text-muted">
            Turn Leave Mode on when you go on leave: the brand&apos;s leave cover can then edit it until you turn it
            off. Archive a brand to take it off Home; its data and history are kept. Delete removes it and everything in it for good.
          </p>
          <ul className="space-y-3">
            {brands.map((brand) => (
              <li key={brand.id} className={`rounded-2xl border border-line p-4 ${brand.is_archived ? "opacity-60" : ""}`}>
                <BrandStripe colour={brand.colour} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{brand.name}</div>
                    <div className="text-sm text-muted">
                      Cover: {nameOf.get(brand.leave_cover_person_id ?? "") ?? "not set"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!brand.is_archived && (
                      <form action={setLeaveMode}>
                        <input type="hidden" name="brandId" value={brand.id} />
                        <input type="hidden" name="on" value={String(!brand.leave_mode_on)} />
                        <Button variant={brand.leave_mode_on ? "danger" : "secondary"} className="min-h-10 px-4">
                          {brand.leave_mode_on ? "Leave off" : "Leave on"}
                        </Button>
                      </form>
                    )}
                    <form action={setBrandArchived}>
                      <input type="hidden" name="brandId" value={brand.id} />
                      <input type="hidden" name="archived" value={String(!brand.is_archived)} />
                      <Button variant="secondary" className="min-h-10 px-4">{brand.is_archived ? "Restore" : "Archive"}</Button>
                    </form>
                    <DeleteWorldForm brandId={brand.id} brandName={brand.name} />
                  </div>
                </div>
                <div className="mt-2">
                  {brand.is_archived ? (
                    <Badge>Archived</Badge>
                  ) : brand.leave_mode_on ? (
                    <Badge tone="amber">Leave Mode on: cover can edit</Badge>
                  ) : (
                    <Badge>Leave Mode off</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <SectionTitle>Logins</SectionTitle>
          <ul className="divide-y divide-line">
            {profiles.map((profile) => (
              <li key={profile.user_id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{nameOf.get(profile.person_id ?? "") ?? profile.email}</span>
                  <Badge tone={profile.app_role === "admin" ? "green" : "grey"}>{ROLE_LABELS[profile.app_role]}</Badge>
                  {!profile.is_active && <Badge tone="red">Deactivated</Badge>}
                </div>
                <div className="text-sm text-muted">{profile.email}</div>
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
          <ul className="mb-3 space-y-1 text-sm text-muted">
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
              <li key={role}>
                <span className="font-medium text-ink">{ROLE_LABELS[role]}:</span> {ROLE_DESCRIPTIONS[role]}
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
