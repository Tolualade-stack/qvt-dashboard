// Everything open for a person, in one list, soonest first. Pure, so the rules
// for who sees what can be tested without a database.

import { AD_STATUS_LABELS, adTone, money, type Ad } from "@/lib/ads";
import { STATUS_LABELS, nextStatus, statusTone, type ContentItem } from "@/lib/content";
import { REPORT_KIND_LABELS, dueDay, type CreativeAsset, type Report } from "@/lib/reports";
import { shortDate } from "@/lib/format";
import { AREAS } from "@/lib/campaign-setup";

export type WorkKind = "content" | "ad" | "report" | "asset" | "deliverable" | "numbers";

export type WorkAction =
  | "content:posted" | "content:approved" | `content:next:${string}`
  | "ad:live" | "ad:ended" | "ad:funds"
  | "report:sent" | "asset:deployed" | "deliverable:more" | "numbers:add"
  | "issue:raise" | "issue:resolve";

export type WorkChip = { action: WorkAction; label: string; tone: "main" | "plain" | "warn" };

export type WorkItem = {
  key: string;
  kind: WorkKind;
  id: string;
  brandId: string;
  brandName: string;
  colour: string;
  campaignId: string | null;
  campaignName: string | null;
  area: string;
  coverName: string | null;
  title: string;
  where: string;
  due: string | null;        // YYYY-MM-DD, for sorting and grouping
  dueLabel: string;
  status: string;
  statusTone: { bg: string; fg: string };
  chips: WorkChip[];
  openHref: string | null;
  issueOpen: boolean;
};

export type Campaign = {
  id: string;
  brand_id: string;
  name: string;
  status: "live" | "ended";
  account_lead_person_id: string | null;
  creative_assets_target: number | null;
  track_assets: boolean;
  track_numbers: boolean;
  channels: string[];
  is_archived: boolean;
};

export type Deliverable = {
  id: string;
  campaign_id: string;
  brand_id: string;
  area: string;
  group_id: string;
  title: string;
  detail: string | null;
  unit: string;
  planned_qty: number | null;
  done_qty: number;
  is_archived: boolean;
};

export type WorkIssue = { id: string; brand_id: string; item_type: string; item_id: string; title: string; note: string | null; raised_at: string; resolved_at: string | null };

type BrandRow = { id: string; name: string; colour: string; leave_mode_on: boolean; leave_cover_person_id: string | null };
type ContentRow = ContentItem & { campaign_id: string | null };
type AdRow = Ad & { campaign_id: string | null };
type ReportRow = Report & { campaign_id: string | null };
type AssetRow = Pick<CreativeAsset, "status"> & { campaign_id: string | null };

const GREY = { bg: "#EEF1F5", fg: "#44516B" };
const AMBER = { bg: "#FFF3D6", fg: "#7A4B00" };
const RED = { bg: "#FDE7E7", fg: "#A11A1A" };
const ISSUE_CHIP: WorkChip = { action: "issue:raise", label: "Issue", tone: "warn" };

export type WorkInput = {
  personId: string | null;
  seesAll: boolean;          // the Admin, unless viewing as someone
  brands: BrandRow[];
  campaigns: Campaign[];
  areas: { campaign_id: string; area: string; person_id: string }[];
  people: { id: string; full_name: string }[];
  content: ContentRow[];
  ads: AdRow[];
  fundsPendingAds: string[];
  reports: ReportRow[];
  assets: AssetRow[];
  deliverables: Deliverable[];
  issues: WorkIssue[];
  lastNumbers: Record<string, string | null>;   // brand -> latest numbers period end
};

export function buildWork(input: WorkInput): WorkItem[] {
  const { personId, seesAll } = input;
  const brandOf = new Map(input.brands.map((b) => [b.id, b]));
  const campaignOf = new Map(input.campaigns.map((c) => [c.id, c]));
  const nameOf = (id: string | null | undefined) => input.people.find((p) => p.id === id)?.full_name ?? null;
  const coverId = (campaignId: string, area: string) => input.areas.find((a) => a.campaign_id === campaignId && a.area === area)?.person_id ?? null;
  const openIssue = (type: string, id: string) => input.issues.some((i) => !i.resolved_at && i.item_type === type && i.item_id === id);

  // Work outside a campaign keeps the old rule: open to whoever updates the brand.
  // In a campaign: its area's cover, its lead, or leave cover while Leave Mode is on.
  const mine = (brandId: string, campaignId: string | null, area: string) => {
    if (seesAll || !campaignId) return true;
    const campaign = campaignOf.get(campaignId);
    const brand = brandOf.get(brandId);
    if (!campaign || !brand || !personId) return false;
    return (
      coverId(campaignId, area) === personId ||
      campaign.account_lead_person_id === personId ||
      (brand.leave_mode_on && brand.leave_cover_person_id === personId)
    );
  };
  const running = (campaignId: string | null) => {
    if (!campaignId) return true;
    const c = campaignOf.get(campaignId);
    return !!c && c.status === "live" && !c.is_archived;
  };
  const base = (kind: WorkKind, id: string, brandId: string, campaignId: string | null, area: string) => {
    const brand = brandOf.get(brandId);
    const campaign = campaignId ? campaignOf.get(campaignId) : null;
    if (!brand) return null;
    return {
      key: `${kind}:${id}`,
      kind,
      id,
      brandId,
      brandName: brand.name,
      colour: brand.colour,
      campaignId,
      campaignName: campaign?.name ?? null,
      area,
      coverName: campaign ? (nameOf(coverId(campaign.id, area)) ?? nameOf(campaign.account_lead_person_id)) : null,
    };
  };
  const place = (brandName: string, campaignName: string | null, extra = "") => [brandName, campaignName, extra].filter(Boolean).join(" · ");
  const issueChips = (type: string, id: string): WorkChip[] =>
    openIssue(type, id) ? [{ action: "issue:resolve", label: "Issue sorted", tone: "plain" }] : [ISSUE_CHIP];

  const items: WorkItem[] = [];

  for (const c of input.content) {
    if (c.is_archived || c.status === "posted" || !running(c.campaign_id) || !mine(c.brand_id, c.campaign_id, "content")) continue;
    const head = base("content", c.id, c.brand_id, c.campaign_id, "content");
    if (!head) continue;
    const next = nextStatus(c.status, c.needs_approval);
    const issue = openIssue("content", c.id);
    const chips: WorkChip[] = [];
    if (next && next !== "posted") chips.push({ action: `content:next:${next}`, label: STATUS_LABELS[next], tone: "main" });
    if (next !== "approved" && !["approved", "scheduled"].includes(c.status) && c.needs_approval) chips.push({ action: "content:approved", label: "Approved", tone: "plain" });
    chips.push({ action: "content:posted", label: "Posted", tone: next === "posted" ? "main" : "plain" });
    chips.push(...issueChips("content", c.id));
    items.push({
      ...head,
      title: c.title,
      where: place(head.brandName, head.campaignName),
      due: c.planned_date,
      dueLabel: c.planned_date ? shortDate(c.planned_date) : "No date",
      status: issue ? "Issue open" : STATUS_LABELS[c.status],
      statusTone: issue ? RED : statusTone(c.status),
      chips,
      openHref: `/brands/${c.brand_id}/content/${c.id}`,
      issueOpen: issue,
    });
  }

  for (const a of input.ads) {
    if (a.is_archived || a.status === "ended" || !running(a.campaign_id) || !mine(a.brand_id, a.campaign_id, "ads")) continue;
    const head = base("ad", a.id, a.brand_id, a.campaign_id, "ads");
    if (!head) continue;
    const isLive = a.status === "live";
    const funds = input.fundsPendingAds.includes(a.id);
    items.push({
      ...head,
      title: a.name,
      where: place(head.brandName, head.campaignName, a.budget != null ? money(Number(a.budget), a.currency) : ""),
      due: null,
      dueLabel: isLive ? "Running" : "To do",
      status: a.issue_raised_at ? "Issue open" : funds ? "Funds requested" : AD_STATUS_LABELS[a.status],
      statusTone: a.issue_raised_at ? RED : funds ? AMBER : adTone(a.status),
      chips: [
        isLive ? { action: "ad:ended", label: "Ad ended", tone: "main" } : { action: "ad:live", label: "Ad live", tone: "main" },
        { action: "ad:funds", label: "Need funds", tone: "warn" },
        a.issue_raised_at ? { action: "issue:resolve", label: "Issue sorted", tone: "plain" } : ISSUE_CHIP,
      ],
      openHref: `/brands/${a.brand_id}/ads/${a.id}`,
      issueOpen: !!a.issue_raised_at,
    });
  }

  for (const r of input.reports) {
    if (r.sent_at || !running(r.campaign_id) || !mine(r.brand_id, r.campaign_id, "reports")) continue;
    const head = base("report", r.id, r.brand_id, r.campaign_id, "reports");
    if (!head) continue;
    const issue = openIssue("report", r.id);
    items.push({
      ...head,
      title: REPORT_KIND_LABELS[r.kind],
      where: place(head.brandName, head.campaignName, r.period_label),
      due: lagosDay(r.due_at),
      dueLabel: dueDay(r.due_at),
      status: issue ? "Issue open" : "Not sent",
      statusTone: issue ? RED : GREY,
      chips: [{ action: "report:sent", label: "Report sent", tone: "main" }, ...issueChips("report", r.id)],
      openHref: `/brands/${r.brand_id}/update?tab=reports`,
      issueOpen: issue,
    });
  }

  for (const d of input.deliverables) {
    const finished = d.planned_qty != null && d.done_qty >= d.planned_qty;
    if (d.is_archived || finished || !running(d.campaign_id) || !mine(d.brand_id, d.campaign_id, d.area)) continue;
    const head = base("deliverable", d.id, d.brand_id, d.campaign_id, d.area);
    if (!head) continue;
    const issue = openIssue("deliverable", d.id);
    items.push({
      ...head,
      title: d.title,
      where: place(head.brandName, head.campaignName, d.detail ?? ""),
      due: null,
      dueLabel: d.planned_qty != null ? `${d.done_qty} of ${d.planned_qty}` : String(d.done_qty),
      status: issue ? "Issue open" : d.unit[0].toUpperCase() + d.unit.slice(1),
      statusTone: issue ? RED : GREY,
      chips: [{ action: "deliverable:more", label: `1 more ${d.unit}`, tone: "main" }, ...issueChips("deliverable", d.id)],
      openHref: d.campaign_id ? `/brands/${d.brand_id}/campaigns/${d.campaign_id}` : null,
      issueOpen: issue,
    });
  }

  for (const c of input.campaigns) {
    if (c.status !== "live" || c.is_archived) continue;
    if (c.track_assets && c.creative_assets_target && mine(c.brand_id, c.id, "assets")) {
      const done = input.assets.filter((a) => a.campaign_id === c.id && a.status === "deployed").length;
      const head = base("asset", c.id, c.brand_id, c.id, "assets");
      if (head && done < c.creative_assets_target) {
        const issue = openIssue("asset", c.id);
        items.push({
          ...head,
          title: "Creative assets",
          where: place(head.brandName, c.name),
          due: null,
          dueLabel: `${done} of ${c.creative_assets_target}`,
          status: issue ? "Issue open" : "Deployed",
          statusTone: issue ? RED : GREY,
          chips: [{ action: "asset:deployed", label: "1 more deployed", tone: "main" }, ...issueChips("asset", c.id)],
          openHref: `/brands/${c.brand_id}/update?tab=assets`,
          issueOpen: issue,
        });
      }
    }
    if (c.track_numbers && c.channels.length > 0 && mine(c.brand_id, c.id, "numbers")) {
      const head = base("numbers", c.id, c.brand_id, c.id, "numbers");
      const last = input.lastNumbers[c.brand_id] ?? null;
      if (head) {
        const issue = openIssue("numbers", c.id);
        items.push({
          ...head,
          title: "Weekly numbers",
          where: place(head.brandName, c.name, `${c.channels.length} channels`),
          due: null,
          dueLabel: last ? `Last ${shortDate(last)}` : "None yet",
          status: issue ? "Issue open" : "Weekly",
          statusTone: issue ? RED : GREY,
          chips: [{ action: "numbers:add", label: "Add numbers", tone: "main" }, ...issueChips("numbers", c.id)],
          openHref: `/brands/${c.brand_id}/update?tab=numbers`,
          issueOpen: issue,
        });
      }
    }
  }

  // Dated work soonest first, then undated work.
  return items.sort((a, b) => {
    if (a.due && b.due) return a.due.localeCompare(b.due);
    if (a.due) return -1;
    if (b.due) return 1;
    return a.title.localeCompare(b.title);
  });
}

// Lagos is UTC+1 all year.
export function lagosDay(iso: string | number): string {
  return new Date(new Date(iso).getTime() + 3_600_000).toISOString().slice(0, 10);
}

export type WorkGroup = { label: string; items: WorkItem[] };

export function groupWork(items: WorkItem[], now: number): WorkGroup[] {
  const today = lagosDay(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay() || 7; // Monday 1 ... Sunday 7
  const endOfWeek = lagosDay(new Date(`${today}T00:00:00Z`).getTime() + (7 - weekday) * 86_400_000);
  const endOfNext = lagosDay(new Date(`${endOfWeek}T00:00:00Z`).getTime() + 7 * 86_400_000);
  const buckets: [string, (i: WorkItem) => boolean][] = [
    ["Late", (i) => !!i.due && i.due < today],
    ["Today", (i) => i.due === today],
    ["This week", (i) => !!i.due && i.due > today && i.due <= endOfWeek],
    ["Next week", (i) => !!i.due && i.due > endOfWeek && i.due <= endOfNext],
    ["Later", (i) => !!i.due && i.due > endOfNext],
    ["Keep going", (i) => !i.due],
  ];
  return buckets.map(([label, test]) => ({ label, items: items.filter(test) })).filter((g) => g.items.length);
}

export const areaLabel = (area: string) => AREAS[area]?.label ?? area;

// The moment a check-in is due: from 5 pm Lagos time.
export function isCheckInTime(now: number) {
  return new Date(now + 3_600_000).getUTCHours() >= 17;
}

export const CHECK_IN_NOTE = "Checked in: nothing changed.";
