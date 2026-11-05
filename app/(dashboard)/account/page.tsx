import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/types";
import { Button, Card, PageTitle, SectionTitle } from "@/components/ui";
import { signOut } from "@/app/login/actions";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "My account · PRIME" };

export default async function AccountPage() {
  const me = (await getCurrentUser())!;

  return (
    <>
      <PageTitle>My account</PageTitle>
      <div className="space-y-4">
        <Card>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Name</dt>
              <dd>{me.name}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Email</dt>
              <dd className="break-all text-right">{me.email}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Role</dt>
              <dd>{ROLE_LABELS[me.role]}</dd>
            </div>
          </dl>
          <p className="mt-2 text-sm text-muted">{ROLE_DESCRIPTIONS[me.role]}</p>
        </Card>
        {me.role === "admin" && (
          <Link href="/admin" className="prime-gradient flex min-h-14 items-center justify-between gap-3 rounded-3xl p-5 font-display text-lg font-extrabold text-white">
            Admin and team
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
          </Link>
        )}
        <Card>
          <SectionTitle>Change password</SectionTitle>
          <ChangePasswordForm />
        </Card>
        <form action={signOut}>
          <Button variant="secondary" className="w-full">Sign out</Button>
        </form>
      </div>
    </>
  );
}
