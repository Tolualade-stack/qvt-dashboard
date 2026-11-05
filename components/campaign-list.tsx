import Link from "next/link";
import { shortDate } from "@/lib/format";
import type { worldTheme } from "@/lib/colour";

export type CampaignSummary = { id: string; name: string; objective: string | null; start_date: string | null; end_date: string | null; status: "live" | "ended" };

// A brand's campaigns, on its World page.
export function CampaignList({ brandId, campaigns, theme, canAdd }: { brandId: string; campaigns: CampaignSummary[]; theme: ReturnType<typeof worldTheme>; canAdd: boolean }) {
  if (campaigns.length === 0 && !canAdd) return null;
  return (
    <section className="mt-6">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-black">Campaigns</h2>
        {canAdd && (
          <Link href={`/brands/${brandId}/campaigns/new`} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold" style={{ backgroundColor: theme.main, color: theme.onMain }}>
            + New campaign
          </Link>
        )}
      </div>
      {campaigns.length === 0 && <p className="text-sm text-muted">No campaigns yet. Start one to give the team their work.</p>}
      <div className="space-y-2.5">
        {campaigns.map((c) => (
          <Link key={c.id} href={`/brands/${brandId}/campaigns/${c.id}`} className="block rounded-[20px] p-4 transition hover:brightness-95" style={{ backgroundColor: theme.soft }}>
            <div className="flex items-start justify-between gap-2.5">
              <div className="font-display text-xl leading-tight font-black" style={{ color: theme.ink }}>{c.name}</div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${c.status === "live" ? "bg-[#E3F5EA] text-[#17633A]" : "bg-white text-muted"}`}>{c.status === "live" ? "Live" : "Ended"}</span>
            </div>
            {c.objective && <p className="mt-1 line-clamp-2 text-[13px] leading-snug">{c.objective}</p>}
            {(c.start_date || c.end_date) && (
              <p className="mt-1 text-xs text-muted">{[c.start_date, c.end_date].filter((d): d is string => !!d).map(shortDate).join(" to ")}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
