// Client reports and creative assets: shapes, labels and status helpers.

export type Report = {
  id: string;
  brand_id: string;
  kind: "weekly" | "biweekly" | "monthly" | "other";
  period_label: string;
  due_at: string;
  sent_at: string | null;
  link: string | null;
  notes: string | null;
};

export const REPORT_KIND_LABELS: Record<Report["kind"], string> = {
  weekly: "Weekly report",
  biweekly: "Bi-weekly report",
  monthly: "Monthly report",
  other: "Report",
};

// Where a report stands right now.
export function reportState(r: Pick<Report, "due_at" | "sent_at">, now = Date.now()): "sent" | "overdue" | "due_soon" | "upcoming" {
  if (r.sent_at) return "sent";
  const hoursLeft = (new Date(r.due_at).getTime() - now) / 3_600_000;
  if (hoursLeft < 0) return "overdue";
  if (hoursLeft < 48) return "due_soon";
  return "upcoming";
}

export const REPORT_TONES = {
  sent: { bg: "#E3F5EA", fg: "#17633A" },
  overdue: { bg: "#FDE7E7", fg: "#A11A1A" },
  due_soon: { bg: "#FFF3D6", fg: "#7A4B00" },
  upcoming: { bg: "#EEF1F5", fg: "#44516B" },
};

// How late an unsent report is, e.g. "5 h" or "3 days".
export function lateBy(dueAt: string, now = Date.now()): string {
  const hours = (now - new Date(dueAt).getTime()) / 3_600_000;
  return hours < 24 ? `${Math.max(1, Math.ceil(hours))} h` : `${Math.floor(hours / 24)} days`;
}

// e.g. "Wed 4 Nov", in Lagos time.
export function dueDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" }).format(new Date(iso));
}

export type AssetStatus = "in_production" | "ready" | "deployed";

export type CreativeAsset = {
  id: string;
  brand_id: string;
  title: string;
  asset_type: string | null;
  status: AssetStatus;
  status_changed_at: string;
  deployed_at: string | null;
  link: string | null;
  owner_person_id: string | null;
  notes: string | null;
  is_archived: boolean;
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  in_production: "In production",
  ready: "Ready",
  deployed: "Deployed",
};

export const NEXT_ASSET_STATUS: Record<AssetStatus, AssetStatus | null> = {
  in_production: "ready",
  ready: "deployed",
  deployed: null,
};

export const ASSET_TYPES = ["Static", "Video", "Carousel", "TVC cut (6 s)", "TVC cut (10 s)", "TVC cut (15 s)", "TVC cut (30 s)", "TVC cut (60 s)"];
