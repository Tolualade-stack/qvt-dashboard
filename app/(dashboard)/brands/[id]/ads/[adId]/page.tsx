import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadWorld } from "@/lib/world";
import { formatDateTime } from "@/lib/format";
import { CHANNELS } from "@/lib/campaign";
import { AD_STATUS_LABELS, adTone, money, type Ad, type FundRequest } from "@/lib/ads";
import type { AuditEntry } from "@/lib/types";
import { HistoryList } from "@/components/history-list";
import { Card, SectionTitle } from "@/components/ui";
import { AdForm } from "../ad-form";
import { RemoveButton } from "@/components/remove-button";
import { removeWork } from "../../remove-actions";

export const metadata: Metadata = { title: "Ad · PRIME" };

// One ad: where it stands, its fund requests, its full history, and (for
// editors) its details.
export default async function AdPage({ params }: PageProps<"/brands/[id]/ads/[adId]">) {
  const { id, adId } = await params;
  const { brand, theme, people, canEdit, supabase } = await loadWorld(id);
  const channels = CHANNELS.filter((c) => brand.channels.includes(c.id)).map((c) => ({ id: c.id, label: c.label, formats: c.formats }));

  const [{ data: row }, { data: fundRows }] = await Promise.all([
    supabase.from("ads").select("*").eq("id", adId).eq("brand_id", id).maybeSingle(),
    supabase.from("fund_requests").select("*").eq("ad_id", adId).order("requested_at", { ascending: false }),
  ]);
  if (!row) notFound();
  const ad = row as Ad;
  const funds = (fundRows ?? []) as FundRequest[];

  const { data: historyRows } = await supabase
    .from("audit_log")
    .select("*")
    .or(`and(table_name.eq.ads,row_id.eq.${adId}),and(table_name.eq.fund_requests,row_id.in.(${funds.map((f) => f.id).join(",") || "00000000-0000-0000-0000-000000000000"}))`)
    .order("changed_at", { ascending: false });

  const tone = adTone(ad.status);
  const facts = [
    ["Channel", CHANNELS.find((c) => c.id === ad.channel)?.label ?? ad.channel],
    ["Format", ad.format ?? "Not set"],
    ["Owner", people.find((p) => p.id === ad.owner_person_id)?.label ?? "Not set"],
    ["In this stage since", formatDateTime(ad.status_changed_at)],
    ["Went live", ad.went_live_at ? formatDateTime(ad.went_live_at) : "Not yet"],
    ["Ended", ad.ended_at ? formatDateTime(ad.ended_at) : "Not yet"],
    ["Budget", ad.budget ? money(Number(ad.budget), ad.currency) : "Not set"],
    ["Spend to date", `${money(Number(ad.spend_to_date), ad.currency)}${ad.spend_updated_at ? ` (as of ${formatDateTime(ad.spend_updated_at)})` : ""}`],
  ];

  return (
    <div className="space-y-4">
      <Link href={`/brands/${id}/update?tab=ads`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        {brand.name} · Ads
      </Link>

      <div>
        <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: tone.bg, color: tone.fg }}>{AD_STATUS_LABELS[ad.status]}</span>
        <h1 className="mt-2 font-display text-3xl leading-tight font-black">{ad.name}</h1>
        {ad.issue_raised_at && (
          <p className="mt-2 rounded-2xl bg-amber-100 p-3 text-sm text-amber-950">
            <b>Issue raised {formatDateTime(ad.issue_raised_at)}:</b> {ad.issue_note}
          </p>
        )}
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {ad.notes && <p className="mt-3 border-t border-line pt-3 text-sm">{ad.notes}</p>}
      </Card>

      <Card>
        <SectionTitle>Fund requests</SectionTitle>
        {funds.length === 0 && <p className="text-sm text-muted">None yet.</p>}
        <ul className="divide-y divide-line">
          {funds.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <span>
                <span className="block font-semibold">{money(Number(f.amount), f.currency)}</span>
                <span className="block text-xs text-muted">
                  Requested {formatDateTime(f.requested_at)}
                  {f.resolved_at ? ` · ${f.status} ${formatDateTime(f.resolved_at)}` : ""}
                </span>
                {f.note && <span className="block text-xs">{f.note}</span>}
              </span>
              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold capitalize"
                style={f.status === "pending" ? { backgroundColor: "#FFF3D6", color: "#7A4B00" } : { backgroundColor: theme.soft, color: theme.ink }}
              >
                {f.status}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <SectionTitle>History</SectionTitle>
        <HistoryList entries={(historyRows ?? []) as AuditEntry[]} />
      </Card>

      {canEdit && (
        <section>
          <h2 className="mb-2 font-display text-xl font-black">Edit details</h2>
          <AdForm brandId={id} channels={channels} people={people} ad={ad} />
          <div className="mt-4">
            <RemoveButton label="Remove this ad" action={removeWork.bind(null, "ad", ad.id, id)} goTo={`/brands/${id}/update?tab=ads`} />
          </div>
        </section>
      )}
    </div>
  );
}
