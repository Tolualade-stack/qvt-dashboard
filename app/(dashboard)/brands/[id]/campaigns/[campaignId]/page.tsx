import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadWorld } from "@/lib/world";
import { mediaUrl } from "@/lib/media";
import { CampaignHero } from "@/components/campaign-hero";
import { AREAS, KPI_METRICS, PANELS, areasFor } from "@/lib/campaign-setup";
import { compact, summarise, type ChannelMetric } from "@/lib/metrics";
import { money, spendSummary, type Ad } from "@/lib/ads";
import { STATUS_LABELS, statusTone, type ContentItem } from "@/lib/content";
import { adTone, AD_STATUS_LABELS } from "@/lib/ads";
import { REPORT_KIND_LABELS, REPORT_TONES, dueDay, reportState, type CreativeAsset, type Report } from "@/lib/reports";
import { shortDate } from "@/lib/format";
import { channelName } from "@/lib/campaign";
import type { BudgetLine } from "@/lib/budget";
import { setCampaignStatus } from "../actions";

export const metadata: Metadata = { title: "Campaign · PRIME" };

type Deliverable = { id: string; group_id: string; title: string; detail: string | null; unit: string; planned_qty: number | null; done_qty: number; area: string };

export default async function CampaignPage({ params, searchParams }: PageProps<"/brands/[id]/campaigns/[campaignId]">) {
  const { id, campaignId } = await params;
  const launched = (await searchParams).launched === "1";
  const { me, brand, theme, supabase } = await loadWorld(id);
  const isAdmin = me.role === "admin";

  const [{ data: campaign }, { data: team }, { data: areaRows }, { data: peopleRows }, { data: workRows }, { data: contentRows }, { data: adRows }, { data: reportRows }, { data: assetRows }, { data: metricRows }, { data: lineRows }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", campaignId).eq("brand_id", id).maybeSingle(),
    supabase.from("campaign_team").select("person_id").eq("campaign_id", campaignId),
    supabase.from("campaign_areas").select("area, person_id").eq("campaign_id", campaignId),
    supabase.from("people").select("id, full_name, email"),
    supabase.from("campaign_deliverables").select("*").eq("campaign_id", campaignId).eq("is_archived", false).order("created_at"),
    supabase.from("content_items").select("*").eq("campaign_id", campaignId).eq("is_archived", false).order("planned_date"),
    supabase.from("ads").select("*").eq("campaign_id", campaignId).eq("is_archived", false),
    supabase.from("reports").select("*").eq("campaign_id", campaignId).order("due_at"),
    supabase.from("creative_assets").select("status").eq("campaign_id", campaignId).eq("is_archived", false),
    supabase.from("channel_metrics").select("*").eq("brand_id", id),
    supabase.from("budget_lines").select("*").eq("campaign_id", campaignId).order("sort_order"),
  ]);
  if (!campaign) notFound();

  const personName = (pid: string | null) => (peopleRows ?? []).find((p) => p.id === pid)?.full_name ?? null;
  const leadName = personName(campaign.account_lead_person_id) ?? "Not set";
  const coverOf = new Map((areaRows ?? []).map((a) => [a.area as string, a.person_id as string]));
  const deliverables = (workRows ?? []) as Deliverable[];
  const content = (contentRows ?? []) as ContentItem[];
  const ads = (adRows ?? []) as Ad[];
  const reports = (reportRows ?? []) as Report[];
  const lines = (lineRows ?? []) as BudgetLine[];
  const metrics = (metricRows ?? []) as ChannelMetric[];
  const assetsDeployed = ((assetRows ?? []) as Pick<CreativeAsset, "status">[]).filter((a) => a.status === "deployed").length;
  const selections = campaign.selections as Record<string, string[]>;
  const quantities = campaign.quantities as Record<string, number | null>;
  const values = summarise(metrics, null).values as Record<string, number | undefined>;
  const spotsAired = deliverables.filter((d) => ["tv", "radio"].includes(d.group_id)).reduce((a, d) => a + d.done_qty, 0);
  const actual = (metric: string): string | null => {
    if (metric === "ad_spend") return spendSummary(ads);
    if (metric === "spots_aired") return String(spotsAired);
    const v = values[metric];
    return v === undefined ? null : compact(v);
  };
  const dates = [campaign.start_date, campaign.end_date].filter(Boolean).map((d: string) => shortDate(d)).join(" to ");
  const signed = async (path: string | null) => (path ? ((await supabase.storage.from("brand-documents").createSignedUrl(path, 3600)).data?.signedUrl ?? null) : null);
  const [planFile, strategyFile] = await Promise.all([signed(campaign.media_plan_path), signed(campaign.strategy_path)]);

  const heading = "font-display text-[22px] font-black";

  return (
    <div className="space-y-5">
      <CampaignHero
        theme={theme}
        banner={mediaUrl(brand.banner_path)}
        logo={mediaUrl(brand.logo_path)}
        brandName={brand.name}
        title={campaign.name}
        label={campaign.status === "live" ? "Live campaign" : "Ended campaign"}
        back={
          <Link href={`/brands/${id}`} aria-label={`Back to ${brand.name}`} className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-black/45 text-white">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
          </Link>
        }
      />

      {launched && (
        <section role="status" className="rounded-[22px] p-[18px]" style={{ background: `linear-gradient(140deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}>
          <div className="font-display text-2xl font-black">{campaign.name} is on</div>
          <p className="mt-1 text-sm opacity-90">The work is now in each person&apos;s My work. PRIME can&apos;t email them yet, so let them know.</p>
          <Link href="/work" className="mt-3 flex min-h-11 items-center justify-center rounded-[14px] bg-white text-sm font-bold" style={{ color: theme.ink }}>See My work</Link>
        </section>
      )}

      <section>
        {campaign.objective && <p className="text-[15px] leading-relaxed">{campaign.objective}</p>}
        <p className="mt-1 text-sm text-muted">{dates || "No dates set"}{campaign.reporting ? ` · ${campaign.reporting}` : ""}</p>
        {isAdmin && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/brands/${id}/campaigns/${campaignId}/edit`} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold" style={{ backgroundColor: theme.main, color: theme.onMain }}>Edit campaign</Link>
            <form action={setCampaignStatus.bind(null, campaignId, id, campaign.status === "live" ? "ended" : "live")}>
              <button type="submit" className="min-h-11 rounded-full border-[1.5px] px-4 text-sm font-semibold" style={{ borderColor: theme.soft }}>
                {campaign.status === "live" ? "End campaign" : "Make it live again"}
              </button>
            </form>
          </div>
        )}
      </section>

      {(campaign.kpis as { metric: string; target: number | null }[]).length > 0 && (
        <section>
          <h2 className={`${heading} mb-2`}>KPIs</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {(campaign.kpis as { metric: string; target: number | null }[]).map((k) => (
              <div key={k.metric} className="rounded-[18px] p-3.5" style={{ backgroundColor: theme.soft }}>
                <div className="text-xs text-muted">{KPI_METRICS.find(([m]) => m === k.metric)?.[1] ?? k.metric}</div>
                <div className="font-display text-[26px] leading-tight font-black" style={{ color: theme.ink }}>{actual(k.metric) ?? "–"}</div>
                <div className="text-xs text-muted">{k.target != null ? `Target ${k.metric === "ad_spend" ? money(k.target, "NGN", true) : compact(k.target)}` : "No target"}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className={`${heading} mb-2`}>Progress</h2>
        <ul className="space-y-2">
          {campaign.track_assets && campaign.creative_assets_target != null && (
            <ProgressRow label="Creative assets" done={assetsDeployed} planned={campaign.creative_assets_target} unit="deployed" theme={theme} who={personName(coverOf.get("assets") ?? null) ?? leadName} />
          )}
          {deliverables.map((d) => (
            <ProgressRow key={d.id} label={d.title} detail={d.detail} done={d.done_qty} planned={d.planned_qty} unit={d.unit} theme={theme} who={personName(coverOf.get(d.area) ?? null) ?? leadName} />
          ))}
        </ul>
      </section>

      {content.length > 0 && (
        <section>
          <h2 className={`${heading} mb-1`}>Content</h2>
          <ul>
            {content.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2.5 border-t py-2.5" style={{ borderColor: theme.soft }}>
                <span className="min-w-0"><Link href={`/brands/${id}/content/${c.id}`} className="block text-sm font-semibold">{c.title}</Link><span className="text-xs text-muted">{c.planned_date ? shortDate(c.planned_date) : "No date"}</span></span>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={statusStyle(statusTone(c.status))}>{STATUS_LABELS[c.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ads.length > 0 && (
        <section>
          <h2 className={`${heading} mb-1`}>Digital ads</h2>
          <ul>
            {ads.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2.5 border-t py-2.5" style={{ borderColor: theme.soft }}>
                <span className="min-w-0"><Link href={`/brands/${id}/ads/${a.id}`} className="block text-sm font-semibold">{a.name}</Link><span className="text-xs text-muted">{a.budget != null ? `${money(Number(a.budget), a.currency)} budget · ` : ""}{money(Number(a.spend_to_date), a.currency)} spent</span></span>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={statusStyle(adTone(a.status))}>{AD_STATUS_LABELS[a.status]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reports.length > 0 && (
        <section>
          <h2 className={`${heading} mb-1`}>Client reports</h2>
          <ul>
            {reports.map((r) => {
              const state = reportState(r);
              return (
                <li key={r.id} className="flex items-center justify-between gap-2.5 border-t py-2.5" style={{ borderColor: theme.soft }}>
                  <span className="min-w-0"><span className="block text-sm font-semibold">{REPORT_KIND_LABELS[r.kind]}</span><span className="text-xs text-muted">{r.period_label} · due {dueDay(r.due_at)}</span></span>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold capitalize" style={statusStyle(REPORT_TONES[state])}>{state.replace("_", " ")}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className={`${heading} mb-2`}>What&apos;s included</h2>
        <div className="space-y-2.5">
          {PANELS.filter((p) => (campaign.marketing_types as string[]).includes(p.type)).map((panel) => (
            <div key={panel.type} className="rounded-[20px] border-[1.5px] p-3.5" style={{ borderColor: theme.soft }}>
              <h3 className="text-[15px] font-bold">{panel.heading}</h3>
              <ul className="mt-1.5 space-y-1.5">
                {panel.groups.filter((g) => (selections[g.id] ?? []).length).map((g) => (
                  <li key={g.id} className="text-[13px] leading-snug">
                    <b>{g.label}{quantities[g.id] != null ? ` (${quantities[g.id]})` : ""}:</b> <span className="text-muted">{selections[g.id].join(", ")}</span>
                  </li>
                ))}
                {!panel.groups.some((g) => (selections[g.id] ?? []).length) && <li className="text-[13px] text-muted">Nothing selected yet.</li>}
              </ul>
            </div>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Info label="Content a month" value={campaign.content_target_min != null ? `${campaign.content_target_min}–${campaign.content_target_max ?? campaign.content_target_min}` : "Not set"} />
          <Info label="Creative assets" value={campaign.creative_assets_target ?? "Not set"} />
          <Info label="Process level" value={<span className="capitalize">{campaign.tier}</span>} />
          <Info label="Monthly cycle" value={campaign.in_monthly_cycle ? "Yes" : "No"} />
        </dl>
      </section>

      <section className="rounded-[20px] p-4" style={{ backgroundColor: theme.soft }}>
        <h2 className="text-[15px] font-bold">Media plan and strategy</h2>
        <ul className="mt-1.5 space-y-1 text-sm">
          {([["Media plan link", campaign.media_plan_url], ["Media plan file", planFile], ["Strategy link", campaign.strategy_url], ["Strategy file", strategyFile]] as const).filter(([, href]) => href).map(([label, href]) => (
            <li key={label}><a href={href!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center font-bold underline" style={{ color: theme.ink }}>{label} ↗</a></li>
          ))}
          {!campaign.media_plan_url && !planFile && !campaign.strategy_url && !strategyFile && <li className="text-muted">Nothing added yet.</li>}
        </ul>
        {lines.length > 0 && (
          <div className="mt-2 border-t pt-2" style={{ borderColor: `${theme.main}33` }}>
            <div className="mb-1 text-xs font-semibold text-muted">Budget lines</div>
            <ul className="space-y-0.5 text-[13px]">
              {lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-2"><span>{channelName(l.channel)}{l.format ? ` · ${l.format}` : ""}</span><b className="shrink-0">{money(Number(l.planned_amount), l.currency)}</b></li>
              ))}
            </ul>
          </div>
        )}
        <Link href={`/brands/${id}/plan`} className="mt-2 inline-flex min-h-9 items-center text-sm font-bold" style={{ color: theme.ink }}>Budget spread →</Link>
      </section>

      <section>
        <h2 className={`${heading} mb-2`}>Team</h2>
        <div className="rounded-[18px] p-3.5" style={{ background: `linear-gradient(140deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}>
          <div className="text-[11px] font-bold tracking-[0.15em] opacity-85">ACCOUNT LEAD</div>
          <div className="font-display text-xl font-black">{leadName}</div>
        </div>
        <ul className="mt-2 space-y-2">
          {(team ?? []).map((t) => {
            const name = personName(t.person_id as string) ?? "Someone";
            const covers = areasFor(campaign.marketing_types as string[]).filter((a) => coverOf.get(a) === t.person_id).map((a) => AREAS[a]?.label ?? a);
            return (
              <li key={t.person_id as string} className="rounded-[18px] p-3.5" style={{ backgroundColor: theme.soft }}>
                <div className="text-[15px] font-bold">{name}</div>
                <div className="text-xs text-muted">Update Manager · {covers.length ? covers.join(", ") : "No areas yet"}</div>
              </li>
            );
          })}
        </ul>
        {campaign.leave_cover_person_id && <p className="mt-2 text-[13px] text-muted">Leave cover: <b className="text-ink">{personName(campaign.leave_cover_person_id)}</b></p>}
      </section>
    </div>
  );
}

function statusStyle(tone: { bg: string; fg: string }) {
  return { backgroundColor: tone.bg, color: tone.fg };
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-mist p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-bold">{value}</dd>
    </div>
  );
}

function ProgressRow({ label, detail, done, planned, unit, theme, who }: { label: string; detail?: string | null; done: number; planned: number | null; unit: string; theme: { main: string; soft: string; ink: string }; who: string }) {
  return (
    <li className="rounded-[18px] p-3.5" style={{ backgroundColor: theme.soft }}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold">{label}</span>
        <span className="shrink-0 font-display font-black" style={{ color: theme.ink }}>{planned != null ? `${done} of ${planned}` : done} <span className="text-xs font-semibold">{unit}</span></span>
      </div>
      {planned ? (
        <div className="mt-1.5 h-1.5 rounded-full bg-white"><div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (done / planned) * 100)}%`, backgroundColor: theme.main }} /></div>
      ) : null}
      <div className="mt-1 text-xs text-muted">{detail ? `${detail} · ` : ""}{who}</div>
    </li>
  );
}
