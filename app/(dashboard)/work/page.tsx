import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { checkedInToday, loadMyWork } from "@/lib/work";
import { groupWork, isCheckInTime } from "@/lib/work-items";
import { currentTime, longDate } from "@/lib/format";
import { WorkList } from "./work-list";

export const metadata: Metadata = { title: "My work · PRIME" };

// Everything open for one person, across brands, soonest first. The page stays in
// PRIME's colours because it can span brands; each item wears its brand's colours.
export default async function MyWorkPage({ searchParams }: PageProps<"/work">) {
  const me = (await getCurrentUser())!;
  const supabase = await createClient();
  const isAdmin = me.role === "admin";
  const asParam = (await searchParams).as;
  const viewAs = isAdmin && typeof asParam === "string" ? asParam : null;

  const { items, managers } = await loadMyWork(supabase, me, viewAs);
  const now = currentTime();
  const groups = groupWork(items, now);
  const checked = await checkedInToday(supabase, me, now);
  const viewedName = managers.find((m) => m.id === viewAs)?.full_name;

  return (
    <div className="space-y-5">
      <section className="prime-gradient -mx-5 -mt-4 rounded-b-[30px] px-5 pt-5 pb-6 text-white sm:mx-0 sm:mt-0 sm:rounded-[30px]">
        <div className="text-[13px] text-[#B9C8EC]">{longDate(new Date(now))} · {viewedName ? `Viewing as ${viewedName}` : `Hello, ${me.name}`}</div>
        <h1 className="mt-1.5 font-display text-[40px] leading-none font-black">My work</h1>
        <p className="mt-2 text-[15px] text-[#DCE4F7]">
          <b className="text-white">{items.length}</b> open{isAdmin && !viewAs ? " across the team" : ""}, soonest first.{viewAs ? "" : " Tap one to update it."}
        </p>
        {isAdmin && managers.length > 0 && (
          <div className="mt-4">
            <div className="text-[11px] font-bold tracking-[0.12em] text-[#B9C8EC]">VIEW AS</div>
            <nav aria-label="View as" className="mt-1.5 flex flex-wrap gap-1.5">
              <Link href="/work" aria-current={!viewAs ? "page" : undefined} className={`flex min-h-11 items-center rounded-full px-3.5 text-[13px] font-bold ${!viewAs ? "bg-white text-navy" : "bg-white/15 text-white"}`}>Everyone</Link>
              {managers.map((m) => (
                <Link key={m.id} href={`/work?as=${m.id}`} aria-current={viewAs === m.id ? "page" : undefined} className={`flex min-h-11 items-center rounded-full px-3.5 text-[13px] font-bold ${viewAs === m.id ? "bg-white text-navy" : "bg-white/15 text-white"}`}>{m.full_name}</Link>
              ))}
            </nav>
          </div>
        )}
      </section>

      {!viewAs && items.length > 0 && !checked && isCheckInTime(now) && (
        <Link href="/check-in" className="prime-gradient flex min-h-[72px] items-center justify-between gap-3 rounded-[22px] p-4 text-white">
          <span>
            <span className="block font-display text-lg font-black">Anything change today?</span>
            <span className="block text-[13px] text-[#DCE4F7]">One tap if nothing did.</span>
          </span>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
        </Link>
      )}

      {items.length === 0 && (
        <p className="rounded-[20px] bg-mist p-5 text-sm text-muted">Nothing open. When a campaign launches, your work shows up here.</p>
      )}

      {/* Keyed so changing who you're viewing as starts the list afresh. */}
      <WorkList key={viewAs ?? "me"} groups={groups} readOnly={!!viewAs} />

      {!viewAs && items.length > 0 && !isCheckInTime(now) && !checked && (
        <Link href="/check-in" className="flex min-h-14 items-center justify-between gap-3 rounded-[20px] bg-mist p-4">
          <span>
            <span className="block text-sm font-bold">End of the day?</span>
            <span className="block text-xs text-muted">PRIME asks from 5 pm. You can check in any time.</span>
          </span>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg>
        </Link>
      )}
      {checked && !viewAs && <p className="text-center text-[13px] text-muted">You checked in today.</p>}
    </div>
  );
}
