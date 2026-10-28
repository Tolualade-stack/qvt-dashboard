import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/types";
import { signOut } from "@/app/login/actions";
import { Button, Card } from "@/components/ui";

// The frame around every logged-in page: header, menu and sign-out.
// The "(dashboard)" folder name groups these pages without adding to the URL.
export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const me = await getCurrentUser();

  // Logged in, but the login has no active profile (never set up, or deactivated).
  if (!me) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <Card>
          <h1 className="text-lg font-semibold">No access</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your login is not active. Ask the Admin to switch it on.
          </p>
          <form action={signOut} className="mt-4">
            <Button variant="secondary" className="w-full">Sign out</Button>
          </form>
        </Card>
      </main>
    );
  }

  const links = [
    { href: "/", label: "Brands" },
    ...(me.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
    { href: "/account", label: "My account" },
  ];

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="font-semibold">QVT Dashboard</Link>
          <div className="flex items-center gap-2 text-right">
            <div className="text-xs leading-tight">
              <div className="font-medium text-slate-900">{me.name}</div>
              <div className="text-slate-500">{ROLE_LABELS[me.role]}</div>
            </div>
            <form action={signOut}>
              <Button variant="secondary" className="min-h-9 px-3 text-xs">Sign out</Button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 pb-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}
