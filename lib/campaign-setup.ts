// What a campaign can include, who can cover it, and the work PRIME drafts from
// a setup. Pure functions, used both in the browser and on the server.

import { CHANNELS, channelName } from "@/lib/campaign";
import type { Currency } from "@/lib/ads";

export type SetupGroup = {
  id: string;
  label: string;
  options: readonly string[];
  qtyLabel?: string;         // "How many" box beside the group
  area?: string;             // who covers it
  title?: string;            // the tracked item's name, e.g. TV spots
  unit?: string;             // e.g. aired: "3 of 12 aired"
};

export type SetupPanel = { type: string; heading: string; hint: string; groups: readonly SetupGroup[] };

// One panel per marketing type. Add new options here; everywhere else follows.
export const PANELS: readonly SetupPanel[] = [
  {
    type: "digital",
    heading: "Digital channels",
    hint: "Tap the ad formats you'll run on each channel.",
    groups: CHANNELS.map((c) => ({ id: c.id, label: c.label, options: c.formats })),
  },
  {
    type: "traditional",
    heading: "Traditional",
    hint: "Tap what applies, then say how many are planned.",
    groups: [
      { id: "tv", label: "TV", options: ["Spot (TVC)", "Programme sponsorship", "Presenter mention", "Product placement"], qtyLabel: "Spots", area: "broadcast", title: "TV spots", unit: "aired" },
      { id: "radio", label: "Radio", options: ["Spot / jingle", "Live read (OAP mention)", "Programme sponsorship", "Sponsored segment"], qtyLabel: "Spots", area: "broadcast", title: "Radio spots", unit: "aired" },
      { id: "print", label: "Print", options: ["Full page", "Half page", "Advertorial", "Insert"], qtyLabel: "Ads", area: "broadcast", title: "Print ads", unit: "run" },
    ],
  },
  {
    type: "ooh",
    heading: "OOH",
    hint: "Tap the types you're buying, then how many.",
    groups: [
      { id: "billboards", label: "Billboards", options: ["Static billboard", "Digital billboard (LED)", "Unipole", "Gantry", "Bridge panel", "Wall drape / building wrap"], qtyLabel: "Sites", area: "ooh", title: "Billboards", unit: "up" },
      { id: "transit", label: "On the move", options: ["Bus branding (BRT, danfo)", "Vehicle / fleet branding", "Keke branding", "BRT stations and bus stops"], qtyLabel: "Units", area: "ooh", title: "Transit branding", unit: "up" },
      { id: "street", label: "Street furniture", options: ["Lamp-post banners", "Bus shelters", "Parasols", "Kiosks"], qtyLabel: "Units", area: "ooh", title: "Street furniture", unit: "up" },
      { id: "place", label: "Places people go", options: ["Airports", "Malls", "Cinemas", "In-store screens"], qtyLabel: "Sites", area: "ooh", title: "Place-based OOH", unit: "up" },
    ],
  },
  {
    type: "experiential",
    heading: "Experiential",
    hint: "Tap the activations you're running.",
    groups: [
      { id: "activations", label: "Activations", options: ["Market storm", "In-store activation", "Product sampling", "Roadshow", "Campus activation", "Event sponsorship", "Pop-up"], qtyLabel: "Count", area: "experiential", title: "Activations", unit: "done" },
    ],
  },
  {
    type: "kol",
    heading: "Influencer/KOL",
    hint: "Who you're working with, and what they'll make.",
    groups: [
      { id: "tiers", label: "Size", options: ["Nano", "Micro", "Macro", "Mega / celebrity"], qtyLabel: "People", area: "kol", title: "Influencers", unit: "signed" },
      { id: "kolcontent", label: "What they'll make", options: ["Sponsored post", "Short video", "Stories", "Live", "Brand ambassador"], qtyLabel: "Posts", area: "kol", title: "Influencer posts", unit: "posted" },
    ],
  },
  {
    type: "pr",
    heading: "PR",
    hint: "Tap the kinds of PR work planned.",
    groups: [
      { id: "prwork", label: "PR work", options: ["Press release", "Advertorial", "Media event", "Interview", "Op-ed", "Blogger outreach"], qtyLabel: "Pieces", area: "pr", title: "PR pieces", unit: "out" },
    ],
  },
];

export const ALL_GROUPS = PANELS.flatMap((p) => p.groups.map((g) => ({ ...g, type: p.type })));

export const AREAS: Record<string, { label: string; detail: string }> = {
  content: { label: "Content", detail: "The content calendar, from draft to posted" },
  assets: { label: "Creative assets", detail: "Production and deployment" },
  ads: { label: "Digital ads", detail: "Ad status, spend, issues and fund requests" },
  numbers: { label: "Channel numbers", detail: "Reach, clicks, video views and the rest" },
  reports: { label: "Client reports", detail: "Reports due to the client" },
  broadcast: { label: "TV, radio and print", detail: "Spots and ads run against the plan" },
  ooh: { label: "OOH", detail: "Billboards and branding going up and coming down" },
  experiential: { label: "Experiential", detail: "Activations against the plan" },
  kol: { label: "Influencer/KOL", detail: "Influencers signed and posts live" },
  pr: { label: "PR", detail: "PR work against the plan" },
};

// The areas a campaign needs, from what it includes.
export function areasFor(types: string[]): string[] {
  const list = ["content", "assets", "reports"];
  if (types.includes("digital")) list.push("ads", "numbers");
  if (types.includes("traditional")) list.push("broadcast");
  for (const t of ["ooh", "experiential", "kol", "pr"]) if (types.includes(t)) list.push(t);
  return list;
}

export const EMAIL_ALERTS = [
  ["assigned", "New work comes to them"],
  ["due_soon", "The day before something is due"],
  ["overdue", "Something of theirs goes overdue"],
  ["replies", "Someone replies to their issue or fund request"],
  ["check_in", "End-of-day check-in at 5 pm"],
] as const;

export const KPI_METRICS = [
  ["impressions", "Impressions"],
  ["reach", "Reach"],
  ["likes", "Likes"],
  ["clicks", "Clicks"],
  ["followers_gained", "Followers gained"],
  ["video_views", "Video views"],
  ["ad_spend", "Ad spend"],
  ["spots_aired", "Spots aired"],
] as const;

// A campaign's own details, as saved.
export type CampaignFields = {
  brand_id: string;
  name: string;
  objective: string | null;
  start_date: string | null;
  end_date: string | null;
  kpis: { metric: string; target: number | null }[];
  marketing_types: string[];
  channels: string[];
  selections: Record<string, string[]>;
  quantities: Record<string, number | null>;
  content_target_min: number | null;
  content_target_max: number | null;
  creative_assets_target: number | null;
  reporting: string | null;
  tier: "heavy" | "medium" | "low";
  in_monthly_cycle: boolean;
  media_plan_url: string | null;
  media_plan_path: string | null;
  strategy_url: string | null;
  strategy_path: string | null;
  account_lead_person_id: string | null;
  leave_cover_person_id: string | null;
  email_alerts: string[];
  team: string[];
  areas: { area: string; person_id: string }[];
};

// Everything sent when launching: the details plus the checked work.
export type CampaignPayload = CampaignFields & {
  track_assets: boolean;
  track_numbers: boolean;
  budget_lines: BudgetDraft[];
  ads: { name: string; channel: string; format: string; budget: number; currency: Currency }[];
  content: { title: string; date: string | null; platforms: string[] }[];
  reports: ReportDraft[];
  deliverables: ReturnType<typeof draftDeliverables>;
  attach_existing: boolean;
};

export type BudgetDraft = { channel: string; format: string; amount: number; currency: Currency };
export type ReportDraft = { kind: "weekly" | "biweekly" | "monthly"; label: string; due_at: string };

// Regular reports across the campaign's dates: weekly and bi-weekly on the
// standing Tuesdays (counted from Tue 3 Nov 2026), due by the end of Wednesday;
// monthly for each month it runs, due by the end of the 7th of the next month.
// All Lagos time (UTC+1 all year), matching the brand-level schedule exactly.
export function draftReports(reporting: string, start: string, end: string): ReportDraft[] {
  if (!start || !end || end < start) return [];
  const DAY = 86_400_000;
  const toUtc = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
  const dueAt = (t: number) => new Date(t + DAY - 61 * 60_000).toISOString(); // 23:59 Lagos that day
  const label = (t: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(t);
  const reports: ReportDraft[] = [];

  const step = /^weekly/i.test(reporting) ? 7 : /^bi-weekly/i.test(reporting) ? 14 : 0;
  if (step) {
    const anchor = toUtc("2026-11-03");
    const from = toUtc(start);
    const after = Math.ceil((from - anchor) / (step * DAY));
    for (let t = anchor + after * step * DAY; t <= toUtc(end); t += step * DAY) {
      reports.push({ kind: step === 7 ? "weekly" : "biweekly", label: `Week of ${label(t)}`, due_at: dueAt(t + DAY) });
    }
  }
  if (/monthly/i.test(reporting)) {
    const first = new Date(toUtc(start));
    const last = new Date(toUtc(end));
    for (let y = first.getUTCFullYear(), m = first.getUTCMonth(); y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth()); m === 11 ? ((y += 1), (m = 0)) : (m += 1)) {
      const name = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m, 1));
      reports.push({ kind: "monthly", label: name, due_at: dueAt(Date.UTC(y, m + 1, 7)) });
    }
  }
  return reports.sort((a, b) => a.due_at.localeCompare(b.due_at));
}

// An ad for each budget line on a digital channel. Non-digital lines are tracked
// as deliverables instead.
export function draftAds(lines: BudgetDraft[]) {
  const digital = new Set<string>(CHANNELS.map((c) => c.id));
  return lines
    .filter((l) => digital.has(l.channel))
    .map((l) => ({
      name: `${channelName(l.channel)}${l.format ? ` ${l.format}` : ""}`,
      channel: l.channel,
      format: l.format,
      budget: l.amount,
      currency: l.currency,
    }));
}

// A counted item for each non-digital group with something selected.
export function draftDeliverables(types: string[], selections: Record<string, string[]>, quantities: Record<string, string>) {
  return ALL_GROUPS.filter((g) => g.area && types.includes(g.type) && (selections[g.id] ?? []).length > 0).map((g) => ({
    area: g.area!,
    group_id: g.id,
    title: g.title ?? g.label,
    detail: (selections[g.id] ?? []).join(", "),
    unit: g.unit ?? "done",
    planned_qty: toCount(quantities[g.id]),
  }));
}

export function toCount(value: string | undefined): number | null {
  const n = Number(String(value ?? "").replace(/[,\s]/g, ""));
  return String(value ?? "").trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

// Digital channels with at least one format chosen.
export function chosenChannels(types: string[], selections: Record<string, string[]>) {
  if (!types.includes("digital")) return [];
  return CHANNELS.filter((c) => (selections[c.id] ?? []).length > 0).map((c) => c.id as string);
}
