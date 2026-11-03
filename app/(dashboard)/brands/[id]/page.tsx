import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { mediaUrl } from "@/lib/media";
import { tint, worldTheme } from "@/lib/colour";
import { formatDateTime, timeAgo } from "@/lib/format";
import { describeChange, whoDidIt } from "@/lib/history";
import { CHANNELS, MARKETING_TYPES, labelFor } from "@/lib/campaign";
import { lagosMonth, monthCounts, type ContentItem } from "@/lib/content";
import { REPORT_KIND_LABELS, REPORT_TONES, dueDay, reportState, type CreativeAsset, type Report } from "@/lib/reports";
import type { UpdateNote } from "@/lib/notes";
import { hoursSince, spendSummary, type Ad, type FundRequest } from "@/lib/ads";
import { TIER_LABELS, type AuditEntry, type Brand, type BrandRole, type Person } from "@/lib/types";
import { Badge, LiveDot } from "@/components/ui";
import { WorldPerformance } from "@/components/world-performance";
import { CanvaLinkForm } from "./canva-link-form";

// A brand's world, laid out like the PRIME mock-up: banner hero, logo and
// profile, performance, creative assets, content progress and the latest updates.
// Numbers start at zero or "–" and fill in as the trackers and live numbers arrive.
export default async function WorldPage({ params }: PageProps<"/brands/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const me = (await getCurrentUser())!;

  const [
    { data: brandRow },
    { data: roleRows },
    { data: peopleRows },
    { data: historyRows },
    { data: contentRows },
    { data: noteRows },
    { data: adRows },
    { data: fundRows },
    { data: reportRows },
    { data: assetRows },
  ] = await Promise.all([
    supabase.from("brands").select("*").eq("id", id).maybeSingle(),
    supabase.from("brand_roles").select("*").eq("brand_id", id).is("ended_at", null).order("sort_order"),
    supabase.from("people").select("id, slug, full_name, is_placeholder"),
    supabase.from("audit_log").select("*").eq("table_name", "brands").eq("row_id", id).order("changed_at", { ascending: false }).limit(8),
    supabase.from("content_items").select("*").eq("brand_id", id),
    supabase.from("update_notes").select("*").eq("brand_id", id).order("created_at", { ascending: false }).limit(8),
    supabase.from("ads").select("*").eq("brand_id", id).eq("is_archived", false),
    supabase.from("fund_requests").select("*").eq("brand_id", id).eq("status", "pending"),
    // Fill in the regular report schedule first, then read the reports still to send.
    supabase.rpc("ensure_reports").then(() =>
      supabase.from("reports").select("*").eq("brand_id", id).is("sent_at", null).order("due_at").limit(3),
    ),
    supabase.from("creative_assets").select("status, deployed_at").eq("brand_id", id).eq("is_archived", false),
  ]);
  if (!brandRow) notFound();

  const brand = brandRow as Brand;
  const roles = (roleRows ?? []) as BrandRole[];
  const people = new Map(((peopleRows ?? []) as Person[]).map((p) => [p.id, p]));
  const content = (contentRows ?? []) as ContentItem[];
  const counts = monthCounts(content);

  // Ads: spend per channel (never mixing ₦ and $), and the warnings that matter.
  const ads = (adRows ?? []) as Ad[];
  const pendingFunds = (fundRows ?? []) as FundRequest[];
  const spendByChannel: Record<string, string | null> = { all: spendSummary(ads) };
  for (const channelId of brand.channels) spendByChannel[channelId] = spendSummary(ads.filter((a) => a.channel === channelId));
  const overview = {
    live: ads.filter((a) => a.status === "live").length,
    paused: ads.filter((a) => a.status === "paused").length,
    issues: ads.filter((a) => a.issue_raised_at).length,
    pendingFunds: pendingFunds.length,
    lateFunds: pendingFunds.filter((f) => hoursSince(f.requested_at) > 24).length,
  };

  // "Latest in this world": changes to the brand and to its content, newest first.
  const contentIds = content.map((c) => c.id);
  const { data: contentHistory } = contentIds.length
    ? await supabase.from("audit_log").select("*").eq("table_name", "content_items").in("row_id", contentIds).order("changed_at", { ascending: false }).limit(8)
    : { data: [] };
  // Notes join the same feed, shown as "Viche noted: …".
  const noteEntries: AuditEntry[] = ((noteRows ?? []) as UpdateNote[]).map((n, i) => ({
    id: -1 - i,
    table_name: "update_notes",
    row_id: n.id,
    action: "insert",
    changed_by_name: n.author_name,
    changed_at: n.created_at,
    old_data: null,
    new_data: { note: n.note },
  }));
  const history = [...((historyRows ?? []) as AuditEntry[]), ...((contentHistory ?? []) as AuditEntry[]), ...noteEntries]
    .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
    .slice(0, 8);
  const coverName = people.get(brand.leave_cover_person_id ?? "")?.full_name;

  const theme = worldTheme(brand.colour);
  const dots = [0, 1, 2].map((i) => brand.palette[i] ?? tint(brand.colour, i * 0.3));
  const banner = mediaUrl(brand.banner_path);
  const logo = mediaUrl(brand.logo_path);
  const channels = brand.channels.map((cid) => CHANNELS.find((c) => c.id === cid)).filter((c) => !!c);

  // "Live · updated 40 min ago by Viche": the most recent recorded change.
  const lastChange = history[0];
  const updatedWhen = timeAgo(lastChange?.changed_at ?? brand.updated_at);
  const updatedBy = lastChange && lastChange.changed_by_name !== "System" ? ` by ${lastChange.changed_by_name}` : "";

  const subtitle = [
    TIER_LABELS[brand.tier].replace(" process", ""),
    ...brand.marketing_types.map((t) => labelFor(MARKETING_TYPES, t)),
    channels.map((c) => c.label).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  // Group the jobs by person, in the order of their first job on this brand.
  const team = new Map<string, BrandRole[]>();
  for (const role of roles) team.set(role.person_id, [...(team.get(role.person_id) ?? []), role]);

  // Mirrors the database rule can_edit_brand(); the database still has the final say.
  const canEdit =
    me.role === "admin" ||
    me.role === "updates_manager" ||
    (me.role === "leave_cover" && brand.leave_mode_on && brand.leave_cover_person_id === me.personId);

  // Creative assets ring: assets deployed this month against the target.
  const monthStart = lagosMonth().startIso;
  const assetsDone = ((assetRows ?? []) as Pick<CreativeAsset, "status" | "deployed_at">[]).filter(
    (a) => a.status === "deployed" && a.deployed_at && a.deployed_at >= monthStart,
  ).length;

  // The next report still to send, for the chip by the logo.
  const nextReport = ((reportRows ?? []) as Report[])[0];
  const nextReportState = nextReport ? reportState(nextReport) : null;
  const assetsTarget = brand.creative_assets_target;
  const ringOffset = Math.round(264 * (1 - (assetsTarget ? assetsDone / assetsTarget : 0)));
  const contentTarget =
    brand.monthly_content_target_min != null
      ? brand.monthly_content_target_min === brand.monthly_content_target_max
        ? `${brand.monthly_content_target_min}`
        : `${brand.monthly_content_target_min}–${brand.monthly_content_target_max}`
      : null;

  return (
    <>
      {/* Hero: the banner photo fading into the brand's deep colour. */}
      <section className="relative -mx-5 -mt-4 h-[340px] overflow-hidden text-white sm:mx-0 sm:mt-0 sm:rounded-t-[30px]" style={{ backgroundColor: theme.deep }}>
        {banner ? (
          <Image src={banner} alt="" fill priority sizes="(max-width: 768px) 100vw, 768px" className="prime-hero-zoom object-cover object-[center_30%]" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0" style={{ background: `linear-gradient(150deg, ${theme.main} 0%, ${theme.deep} 100%)` }} />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 25%, ${theme.deep}a6 50%, ${theme.deep}eb 68%, ${theme.deep} 100%)` }}
        />
        <div className="relative flex items-center justify-between gap-3 px-5 pt-4">
          <Link href="/" aria-label="Back to your worlds" className="flex size-[42px] items-center justify-center rounded-[14px] bg-black/45 text-white">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold">
            <LiveDot colour="#4ADE80" /> Live · updated {updatedWhen}{updatedBy}
          </span>
        </div>
        <div className="absolute inset-x-5 bottom-[26px]">
          <div className="prime-fade-up text-xs font-bold tracking-[0.25em]">WELCOME TO THE WORLD OF</div>
          <h1 className="prime-fade-up mt-0.5 font-display text-[50px] leading-[0.95] font-black tracking-tight" style={{ animationDelay: "0.15s" }}>
            {brand.name}
          </h1>
          <p className="prime-fade-up mt-1.5 text-[13px] text-white/85" style={{ animationDelay: "0.3s" }}>{subtitle}</p>
        </div>
      </section>

      {/* The deep colour runs on behind the logo, which overlaps the hero's edge. */}
      <div className="relative -mx-5 px-5 sm:mx-0" style={{ background: `linear-gradient(180deg, ${theme.deep} 0px, ${theme.deep} 40px, transparent 40px)` }}>
        <div className="flex items-center gap-3.5">
          <span
            className="relative flex size-[76px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white font-display text-3xl font-black shadow-[0_10px_24px_rgba(0,0,0,0.25)]"
            style={{ color: theme.ink }}
          >
            {logo ? <Image src={logo} alt={`${brand.name} logo`} fill sizes="76px" className="object-contain p-1" /> : brand.name.slice(0, 1)}
          </span>
          <div className="mt-9 flex flex-wrap gap-1.5">
            {overview.lateFunds > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800">Fund request over 24 h</span>
            )}
            {overview.issues > 0 && (
              <span className="rounded-full bg-[#FFF1D6] px-2.5 py-1 text-xs font-bold text-[#8A3B00]">
                {overview.issues} ad {overview.issues === 1 ? "issue" : "issues"} open
              </span>
            )}
            {brand.leave_mode_on && (
              <span className="rounded-full bg-[#FFF1D6] px-2.5 py-1 text-xs font-bold text-[#8A3B00]">Leave Mode: {coverName} can edit</span>
            )}
            {nextReport ? (
              <Link
                href={`/brands/${brand.id}/update?tab=reports`}
                className="rounded-full px-2.5 py-1 text-xs font-bold"
                style={
                  nextReportState === "overdue" || nextReportState === "due_soon"
                    ? { backgroundColor: REPORT_TONES[nextReportState].bg, color: REPORT_TONES[nextReportState].fg }
                    : { backgroundColor: theme.soft, color: theme.ink }
                }
              >
                {REPORT_KIND_LABELS[nextReport.kind]} {nextReportState === "overdue" ? "overdue" : `due ${dueDay(nextReport.due_at)}`}
              </Link>
            ) : (
              <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: theme.soft, color: theme.ink }}>{brand.reporting}</span>
            )}
            {me.role === "admin" && (
              <Link href={`/brands/${brand.id}/edit`} className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white">
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" /></svg>
                Edit world
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Brand profile */}
      <section aria-label="Brand profile" className="mt-4">
        {brand.about && <p className="text-[15px] leading-relaxed text-[#2B1A18]">{brand.about}</p>}
        {brand.website && (
          <a href={brand.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-8 items-center gap-1.5 text-sm font-bold" style={{ color: theme.ink }}>
            {brand.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
          </a>
        )}
        <ul className="mt-3 grid grid-cols-3 gap-2.5 border-t pt-3.5" style={{ borderColor: theme.soft }}>
          {[
            ["Industry", brand.industry],
            ["Category", brand.category],
            ["Products", brand.products.join(" · ")],
          ].map(([label, value], i) => (
            <li key={label}>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
                <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: dots[i] }} />
                {label}
              </span>
              <span className="mt-1 block text-sm font-bold">{value || "Not set"}</span>
            </li>
          ))}
        </ul>
      </section>

      <WorldPerformance
        channels={channels.map((c) => ({ id: c.id, label: c.label, formats: c.formats }))}
        theme={theme}
        ads={ads.map((a) => ({ channel: a.channel, format: a.format, status: a.status }))}
        spendByChannel={spendByChannel}
        overview={overview}
      />

      {/* Creative assets deployed */}
      <section className="mt-3.5 flex items-center gap-4 rounded-[22px] bg-ink p-5 text-white">
        <svg role="img" aria-label={`${assetsDone} of ${assetsTarget ?? "no target"} creative assets deployed`} width="96" height="96" viewBox="0 0 100 100" className="shrink-0">
          <circle cx="50" cy="50" r="42" fill="none" stroke={darkTrack(theme.main)} strokeWidth="12" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={dots[2]} strokeWidth="12" strokeLinecap="round" strokeDasharray="264" strokeDashoffset={ringOffset} transform="rotate(-90 50 50)" />
          <text x="50" y="57" textAnchor="middle" fill="#FFFFFF" fontWeight="900" fontSize="22" className="font-display">
            {assetsDone}/{assetsTarget ?? "–"}
          </text>
        </svg>
        <div>
          <div className="font-display text-xl font-black">Creative assets deployed</div>
          <div className="mt-1 text-[13px] text-white/75">
            {channels.length ? `Each asset runs on all ${channels.length} channels. ` : ""}
            {assetsTarget ? "Deployed this month. Mark assets as deployed on the Update screen." : "Set a target with Edit world."}
          </div>
        </div>
      </section>

      {/* Content this month: one bar split by where each piece is now. */}
      <section className="mt-3.5 rounded-[22px] border-[1.5px] p-5" style={{ borderColor: theme.soft }}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-bold">Content this month</h2>
          <span className="font-display text-lg font-black" style={{ color: theme.ink }}>
            {contentTarget ? `${counts.posted} of ${contentTarget}` : `${counts.posted} posted`}
          </span>
        </div>
        <div aria-hidden="true" className="mt-3 flex h-3.5 gap-0.5 overflow-hidden rounded-full" style={{ backgroundColor: theme.soft }}>
          {[
            [counts.posted, dots[0]],
            [counts.scheduled, dots[1]],
            [counts.awaiting, dots[2]],
            [counts.inProgress, "#C9C2BF"],
          ].map(([n, colour], i) =>
            Number(n) > 0 ? (
              <span key={i} style={{ width: `${(Number(n) / Math.max(counts.total, brand.monthly_content_target_max ?? 0, 1)) * 100}%`, backgroundColor: colour as string }} />
            ) : null,
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {[
            [counts.posted, "posted", dots[0]],
            [counts.scheduled, "scheduled", dots[1]],
            [counts.awaiting, "awaiting approval", dots[2]],
            [counts.inProgress, "in progress", "#C9C2BF"],
          ].map(([n, label, colour]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: colour as string }} />
              {n} {label}
            </span>
          ))}
        </div>
        <Link href={`/brands/${brand.id}/update`} className="mt-3 inline-flex min-h-9 items-center text-sm font-bold" style={{ color: theme.ink }}>
          See all content →
        </Link>
      </section>

      {/* Latest in this world */}
      <section className="mt-5">
        <h2 className="mb-1.5 font-display text-[22px] font-black">Latest in this world</h2>
        {history.length === 0 && <p className="text-sm text-muted">Nothing recorded yet.</p>}
        <ul>
          {history.map((entry) => (
            <li key={entry.id} className="flex gap-3 border-t py-3" style={{ borderColor: theme.soft }}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl font-display font-black" style={{ backgroundColor: theme.soft, color: theme.ink }}>
                {whoDidIt(entry).slice(0, 1)}
              </span>
              <div>
                <div className="text-sm">
                  <b>{whoDidIt(entry)}</b> {describeChange(entry)}
                </div>
                <div className="text-xs text-muted">{formatDateTime(entry.changed_at)}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Team & roles */}
      <section className="mt-5 rounded-[22px] border-[1.5px] p-5" style={{ borderColor: theme.soft }}>
        <h2 className="mb-1 text-base font-bold">Team &amp; roles</h2>
        <ul>
          {[...team.entries()].map(([personId, jobs]) => {
            const person = people.get(personId);
            return (
              <li key={personId} className="flex gap-3 border-t py-3" style={{ borderColor: theme.soft }}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mist font-display text-sm font-black">{person?.full_name.slice(0, 1)}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                    {person?.full_name}
                    {jobs.length > 1 && <span className="font-normal text-muted">· {jobs.length} roles</span>}
                    {personId === brand.leave_cover_person_id && <Badge tone="amber">Leave cover</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {jobs.map((job) => (
                      <span key={job.id} className="rounded-md border border-line px-2 py-0.5 text-xs text-muted">{job.title}</span>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Monthly Canva content calendar */}
      <section className="mt-3.5 rounded-[22px] border-[1.5px] p-5" style={{ borderColor: theme.soft }}>
        <h2 className="text-base font-bold">Monthly Canva content calendar</h2>
        {brand.canva_calendar_url ? (
          <a href={brand.canva_calendar_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-9 items-center text-sm font-bold underline" style={{ color: theme.ink }}>
            Open this month&apos;s calendar in Canva
          </a>
        ) : (
          <p className="mt-1 text-sm text-muted">No calendar linked yet.</p>
        )}
        {canEdit && <CanvaLinkForm brandId={brand.id} currentUrl={brand.canva_calendar_url ?? ""} />}
      </section>

      {/* The world's own Update button, floating just above the menu bar. */}
      {canEdit && (
        <Link
          href={`/brands/${brand.id}/update`}
          aria-label={`Add an update to ${brand.name}`}
          className="fixed right-5 bottom-[104px] z-30 inline-flex h-[58px] items-center gap-2.5 rounded-[22px] px-[22px] font-display text-[17px] font-extrabold transition hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain, boxShadow: `0 14px 30px ${theme.main}73` }}
        >
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Update
        </Link>
      )}
    </>
  );
}

// The ring's empty track: a very dark version of the brand colour on black.
function darkTrack(main: string) {
  return worldTheme(main).deep + "66";
}
