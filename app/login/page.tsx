import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · QVT Campaign Dashboard" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-sm font-medium tracking-wide text-slate-500">QVT MEDIA</p>
        <h1 className="mt-1 text-2xl font-semibold">Campaign Dashboard</h1>
      </div>
      <Card>
        <LoginForm />
      </Card>
      <p className="mt-6 text-center text-xs text-slate-500">
        Logins are created by the Admin. There is no public sign-up.
      </p>
    </main>
  );
}
