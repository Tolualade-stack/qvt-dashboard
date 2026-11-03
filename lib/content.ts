// The stages a content piece moves through, and what comes next.
// Without stakeholder approval, a piece goes straight from its asset to Scheduled.

export type ContentStatus =
  | "planned" | "copy_ready" | "asset_in_progress" | "awaiting_approval" | "approved" | "scheduled" | "posted";

export type ContentItem = {
  id: string;
  brand_id: string;
  title: string;
  platforms: string[];
  owner_person_id: string | null;
  planned_date: string | null;
  needs_approval: boolean;
  status: ContentStatus;
  status_changed_at: string;
  copy_ready_at: string | null;
  posted_at: string | null;
  post_url: string | null;
  revision_round: number;
  notes: string | null;
  is_archived: boolean;
  updated_at: string;
};

export const STATUS_LABELS: Record<ContentStatus, string> = {
  planned: "Planned",
  copy_ready: "Copy ready",
  asset_in_progress: "Asset in progress",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  scheduled: "Scheduled",
  posted: "Posted",
};

const ORDER: ContentStatus[] = ["planned", "copy_ready", "asset_in_progress", "awaiting_approval", "approved", "scheduled", "posted"];

export function nextStatus(status: ContentStatus, needsApproval: boolean): ContentStatus | null {
  if (status === "posted") return null;
  if (status === "asset_in_progress" && !needsApproval) return "scheduled";
  return ORDER[ORDER.indexOf(status) + 1];
}

// Colours for each stage: grey before work starts, amber while in progress,
// blue once ready to go out, green when posted.
export function statusTone(status: ContentStatus): { bg: string; fg: string } {
  if (status === "posted") return { bg: "#E3F5EA", fg: "#17633A" };
  if (status === "approved" || status === "scheduled") return { bg: "#E4ECFB", fg: "#1F4A9E" };
  if (status === "asset_in_progress" || status === "awaiting_approval") return { bg: "#FFF3D6", fg: "#7A4B00" };
  return { bg: "#EEF1F5", fg: "#44516B" };
}

// The current month in Lagos time, as a date range for queries.
export function lagosMonth(now = new Date()) {
  const lagos = new Date(now.getTime() + 60 * 60 * 1000); // Lagos is UTC+1 all year
  const y = lagos.getUTCFullYear();
  const m = lagos.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    firstDay: `${y}-${pad(m + 1)}-01`,
    nextFirstDay: m === 11 ? `${y + 1}-01-01` : `${y}-${pad(m + 2)}-01`,
    startIso: new Date(Date.UTC(y, m, 1) - 60 * 60 * 1000).toISOString(),
    label: new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "Africa/Lagos" }).format(now),
  };
}

// Counts for "Content this month": pieces planned this month (by planned date)
// or posted this month, grouped by where they are now.
export function monthCounts(items: ContentItem[], now = new Date()) {
  const month = lagosMonth(now);
  const inMonth = items.filter(
    (i) =>
      !i.is_archived &&
      ((i.planned_date && i.planned_date >= month.firstDay && i.planned_date < month.nextFirstDay) ||
        (i.posted_at && i.posted_at >= month.startIso)),
  );
  const count = (s: ContentStatus[]) => inMonth.filter((i) => s.includes(i.status)).length;
  return {
    total: inMonth.length,
    posted: count(["posted"]),
    scheduled: count(["approved", "scheduled"]),
    awaiting: count(["awaiting_approval"]),
    inProgress: count(["planned", "copy_ready", "asset_in_progress"]),
  };
}
