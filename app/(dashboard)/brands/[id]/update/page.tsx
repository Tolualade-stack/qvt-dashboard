import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { loadWorld, platformLabel } from "@/lib/world";
import { mediaUrl } from "@/lib/media";
import { lagosMonth, type ContentItem } from "@/lib/content";
import { ContentCard } from "../content/content-card";
import { ContentForm } from "../content/content-form";
import { NoteForm } from "../notes/note-form";
import { NoteList } from "@/components/note-list";
import type { UpdateNote } from "@/lib/notes";
import type { Ad, FundRequest } from "@/lib/ads";
import { CHANNELS } from "@/lib/campaign";
import { AdCard } from "../ads/ad-card";
import { AdForm } from "../ads/ad-form";
import { AddAssetForm, AddReportForm, AssetCard, ReportCard } from "../reports/cards";
import type { CreativeAsset, Report } from "@/lib/reports";
import { METRIC_FIELDS, SOURCE_NAMES, compact, type ChannelMetric } from "@/lib/metrics";
import { lagosDate, shortDate } from "@/lib/format";
import { NumbersForm } from "../numbers/numbers-form";

export const metadata: Metadata = { title: "Update · PRIME" };

// The Update screen for one world: add content pieces and move them on with one
// tap. Notes ("What changed?") and numbers join this screen in the next steps.
export default async function UpdatePage({ params, searchParams }: PageProps<"/brands/[id]/update">) {
  const { id } = await params;
  const requested = (await searchParams).tab;
  const tab =
    requested === "note" || requested === "ads" || requested === "assets" || requested === "reports" || requested === "numbers"
      ? requested
      : "content";
  const { brand, theme, platforms, people, canEdit, supabase } = await loadWorld(id);
  const channels = CHANNELS.filter((c) => brand.channels.includes(c.id)).map((c) => ({ id: c.id, label: c.label, formats: c.formats }));

  // Make sure the regular reports up to now (and the next one) exist.
  if (tab === "reports") await supabase.rpc("ensure_reports");

  const [{ data: rows }, { data: noteRows }, { data: adRows }, { data: fundRows }, { data: reportRows }, { data: assetRows }, { data: metricRows }] = await Promise.all([
    supabase
      .from("content_items")
      .select("*")
      .eq("brand_id", id)
      .eq("is_archived", false)
      .order("planned_date", { ascending: true, nullsFirst: false })
      .order("created_at"),
    tab === "note"
      ? supabase.from("update_notes").select("*").eq("brand_id", id).order("created_at", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
    tab === "ads"
      ? supabase.from("ads").select("*").eq("brand_id", id).eq("is_archived", false).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    tab === "ads"
      ? supabase.from("fund_requests").select("*").eq("brand_id", id).eq("status", "pending").order("requested_at")
      : Promise.resolve({ data: [] }),
    tab === "reports"
      ? supabase.from("reports").select("*").eq("brand_id", id).order("due_at")
      : Promise.resolve({ data: [] }),
    tab === "assets"
      ? supabase.from("creative_assets").select("*").eq("brand_id", id).eq("is_archived", false).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    tab === "numbers"
      ? supabase.from("channel_metrics").select("*").eq("brand_id", id).order("created_at", { ascending: false }).limit(12)
      : Promise.resolve({ data: [] }),
  ]);
  const metrics = (metricRows ?? []) as ChannelMetric[];
  const reports = (reportRows ?? []) as Report[];
  const openReports = reports.filter((r) => !r.sent_at);
  const sentReports = reports.filter((r) => r.sent_at).reverse().slice(0, 6);
  const assets = (assetRows ?? []) as CreativeAsset[];
  const deployedThisMonth = assets.filter((a) => a.status === "deployed" && a.deployed_at && a.deployed_at >= lagosMonth().startIso).length;
  const items = (rows ?? []) as ContentItem[];
  const notes = (noteRows ?? []) as UpdateNote[];
  const ads = (adRows ?? []) as Ad[];
  const funds = (fundRows ?? []) as FundRequest[];
  const runningAds = ads.filter((a) => a.status !== "ended");
  const endedAds = ads.filter((a) => a.status === "ended");
  const month = lagosMonth();
  const active = items.filter((i) => i.status !== "posted");
  const posted = items.filter((i) => i.status === "posted" && i.posted_at && i.posted_at >= month.startIso);
  const nameOf = new Map(people.map((p) => [p.id, p.label]));
  const logo = mediaUrl(brand.logo_path);

  return (
    <div className="space-y-5">
      <header
        className="-mx-5 -mt-4 flex items-center gap-3 px-5 pt-5 pb-6 sm:mx-0 sm:mt-0 sm:rounded-[26px]"
        style={{ background: `linear-gradient(150deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}
      >
        <Link href={`/brands/${id}`} aria-label={`Back to ${brand.name}`} className="flex size-[42px] shrink-0 items-center justify-center rounded-[14px] bg-black/30 text-white">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        </Link>
        <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white font-display text-xl font-black" style={{ color: theme.ink }}>
          {logo ? <Image src={logo} alt="" fill sizes="48px" className="object-contain p-1" /> : brand.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="text-xs font-bold tracking-[0.2em] opacity-85">UPDATE</div>
          <h1 className="truncate font-display text-[28px] leading-none font-black">{brand.name}</h1>
        </div>
      </header>

      <nav aria-label="Update type" className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
        {[
          ["content", "Content", `/brands/${id}/update`],
          ["ads", "Ads", `/brands/${id}/update?tab=ads`],
          ["assets", "Assets", `/brands/${id}/update?tab=assets`],
          ["reports", "Reports", `/brands/${id}/update?tab=reports`],
          ["numbers", "Numbers", `/brands/${id}/update?tab=numbers`],
          ["note", "Note", `/brands/${id}/update?tab=note`],
        ].map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            aria-current={tab === key ? "page" : undefined}
            className="flex min-h-11 shrink-0 items-center rounded-full px-5 text-sm font-bold"
            style={tab === key ? { backgroundColor: theme.main, color: theme.onMain } : { backgroundColor: theme.soft, color: theme.ink }}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "numbers" ? (
        <>
          {canEdit ? (
            <NumbersForm brandId={id} channels={platforms} theme={theme} defaultStart={lagosDate(-6)} defaultEnd={lagosDate(0)} />
          ) : (
            <p className="rounded-2xl bg-mist p-4 text-sm text-muted">You can view this world&apos;s numbers, but not add them.</p>
          )}
          <section>
            <h2 className="mb-2 font-display text-xl font-black">Latest uploads</h2>
            {metrics.length === 0 && <p className="text-sm text-muted">No numbers yet.</p>}
            <ul className="divide-y divide-line">
              {metrics.map((m) => (
                <li key={m.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold">{platformLabel(platforms, [m.channel])}</span>
                    <span className="text-xs text-muted">
                      {shortDate(m.period_start)} – {shortDate(m.period_end)} · {m.source === "manual" ? m.author_name : SOURCE_NAMES[m.source]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-muted">
                    {m.spots_aired != null
                      ? `${m.spots_aired} spots aired`
                      : METRIC_FIELDS.filter(([f]) => m[f] != null).map(([f, label]) => `${label} ${compact(Number(m[f]))}`).join(" · ")}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : tab === "reports" ? (
        <>
          <section>
            <h2 className="mb-2 font-display text-xl font-black">Coming up <span className="text-base text-muted">· {openReports.length}</span></h2>
            <p className="mb-3 text-sm text-muted">{brand.reporting}. Regular reports appear here by themselves.</p>
            {openReports.length === 0 && <p className="text-sm text-muted">Nothing due. All reports are sent.</p>}
            <div className="space-y-3">
              {openReports.map((r) => <ReportCard key={r.id} report={r} theme={theme} canEdit={canEdit} />)}
            </div>
          </section>
          {canEdit && <AddReportForm brandId={id} />}
          {sentReports.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-xl font-black">Sent</h2>
              <div className="space-y-3">
                {sentReports.map((r) => <ReportCard key={r.id} report={r} theme={theme} canEdit={canEdit} />)}
              </div>
            </section>
          )}
        </>
      ) : tab === "assets" ? (
        <>
          <p className="rounded-2xl p-4 text-sm font-semibold" style={{ backgroundColor: theme.soft, color: theme.ink }}>
            {deployedThisMonth} of {brand.creative_assets_target ?? "–"} creative assets deployed this month
            {brand.creative_assets_target ? "" : " (set a target with Edit world)"}
          </p>
          {canEdit && <AddAssetForm brandId={id} people={people} />}
          <div className="space-y-3">
            {assets.length === 0 && <p className="text-sm text-muted">No assets yet. Add each one as production starts.</p>}
            {assets.map((a) => (
              <AssetCard key={a.id} asset={a} theme={theme} ownerName={a.owner_person_id ? (nameOf.get(a.owner_person_id) ?? null) : null} canEdit={canEdit} />
            ))}
          </div>
        </>
      ) : tab === "ads" ? (
        <>
          {canEdit ? (
            <AdForm brandId={id} channels={channels} people={people} />
          ) : (
            <p className="rounded-2xl bg-mist p-4 text-sm text-muted">You can view this world&apos;s ads, but not change them.</p>
          )}
          <section>
            <h2 className="mb-2 font-display text-xl font-black">Running <span className="text-base text-muted">· {runningAds.length}</span></h2>
            {runningAds.length === 0 && <p className="text-sm text-muted">No ads yet. Add each ad as it is set up.</p>}
            <div className="space-y-3">
              {runningAds.map((ad) => (
                <AdCard
                  key={ad.id}
                  ad={ad}
                  funds={funds.filter((f) => f.ad_id === ad.id)}
                  theme={theme}
                  channelLabel={channels.find((c) => c.id === ad.channel)?.label ?? ad.channel}
                  ownerName={ad.owner_person_id ? (nameOf.get(ad.owner_person_id) ?? null) : null}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </section>
          {endedAds.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-xl font-black">Ended <span className="text-base text-muted">· {endedAds.length}</span></h2>
              <div className="space-y-3">
                {endedAds.map((ad) => (
                  <AdCard
                    key={ad.id}
                    ad={ad}
                    funds={[]}
                    theme={theme}
                    channelLabel={channels.find((c) => c.id === ad.channel)?.label ?? ad.channel}
                    ownerName={ad.owner_person_id ? (nameOf.get(ad.owner_person_id) ?? null) : null}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      ) : tab === "note" ? (
        <>
          {canEdit ? (
            <section className="rounded-[20px] bg-mist p-4">
              <NoteForm brandId={id} items={items.map((i) => ({ id: i.id, title: i.title }))} theme={theme} />
            </section>
          ) : (
            <p className="rounded-2xl bg-mist p-4 text-sm text-muted">You can read this world&apos;s updates, but not add them.</p>
          )}
          <section>
            <h2 className="mb-1 font-display text-xl font-black">Latest updates</h2>
            <NoteList notes={notes} itemTitleOf={new Map(items.map((i) => [i.id, i.title]))} />
          </section>
        </>
      ) : (
        <>
      {canEdit ? (
        <ContentForm brandId={id} platforms={platforms} people={people} defaultNeedsApproval={brand.tier === "heavy"} />
      ) : (
        <p className="rounded-2xl bg-mist p-4 text-sm text-muted">You can view this world&apos;s content, but not change it.</p>
      )}

      <section>
        <h2 className="mb-2 font-display text-xl font-black">In progress <span className="text-base text-muted">· {active.length}</span></h2>
        {active.length === 0 && <p className="text-sm text-muted">Nothing in progress. Add the pieces from this month&apos;s Canva calendar.</p>}
        <div className="space-y-3">
          {active.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              theme={theme}
              ownerName={item.owner_person_id ? (nameOf.get(item.owner_person_id) ?? null) : null}
              platformLabels={platformLabel(platforms, item.platforms)}
              canEdit={canEdit}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl font-black">Posted in {month.label} <span className="text-base text-muted">· {posted.length}</span></h2>
        {posted.length === 0 && <p className="text-sm text-muted">Nothing posted yet this month.</p>}
        <div className="space-y-3">
          {posted.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              theme={theme}
              ownerName={item.owner_person_id ? (nameOf.get(item.owner_person_id) ?? null) : null}
              platformLabels={platformLabel(platforms, item.platforms)}
              canEdit={canEdit}
            />
          ))}
        </div>
      </section>
        </>
      )}
    </div>
  );
}
