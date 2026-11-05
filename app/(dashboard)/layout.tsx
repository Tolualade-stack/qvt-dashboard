import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/types";
import { signOut } from "@/app/login/actions";
import { Button, Card } from "@/components/ui";
import { PrimeMark, PrimeWordmark } from "@/components/prime-logo";
import { BottomNav } from "@/components/bottom-nav";
import { IntroSplash } from "@/components/intro-splash";

// The frame around every logged-in page: header, floating menu bar.
// The "(dashboard)" folder name groups these pages without adding to the URL.
export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  // Both at once, so the page waits for one round trip instead of two.
  const supabase = await createClient();
  const [me, { data: workspace }] = await Promise.all([
    getCurrentUser(),
    supabase.from("workspaces").select("name").order("sort_order").limit(1).maybeSingle(),
  ]);

  // Logged in, but the login has no active profile (never set up, or deactivated).
  if (!me) {
    return (
      <main className="mx-auto max-w-sm px-4 py-16">
        <Card>
          <h1 className="font-display text-2xl font-black text-navy">No access</h1>
          <p className="mt-2 text-sm text-muted">Your login is not active. Ask your Admin to switch it on.</p>
          <form action={signOut} className="mt-4">
            <Button variant="secondary" className="w-full">Sign out</Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-dvh pb-32">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 pt-5 pb-2">
        <Link href="/" className="flex items-center gap-2.5" aria-label="PRIME home">
          <PrimeMark size={36} />
          <PrimeWordmark height={22} />
        </Link>
        <Link href="/account" className="flex items-center gap-2" aria-label={`${me.name}, ${ROLE_LABELS[me.role]}`}>
          {workspace && <span className="hidden rounded-full bg-mist px-3 py-1.5 text-xs font-semibold text-muted sm:inline">{workspace.name}</span>}
          <span className="flex size-10 items-center justify-center rounded-full bg-ink font-display text-base font-black text-white">
            {me.name.slice(0, 1).toUpperCase()}
          </span>
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-4">{children}</main>
      <BottomNav />
      <IntroSplash />
    </div>
  );
}
