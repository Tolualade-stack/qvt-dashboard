import type { Metadata } from "next";
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
