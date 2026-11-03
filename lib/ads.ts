// Ads and fund requests: their shapes, stages, and money formatting.

export type AdStatus = "not_started" | "set_up" | "live" | "paused" | "ended";
export type Currency = "NGN" | "USD";

export type Ad = {
  id: string;
  brand_id: string;
  name: string;
  channel: string;
  format: string | null;
  owner_person_id: string | null;
  status: AdStatus;
  status_changed_at: string;
  went_live_at: string | null;
  ended_at: string | null;
  currency: Currency;
  budget: number | null;
  spend_to_date: number;
  spend_updated_at: string | null;
  issue_raised_at: string | null;
  issue_note: string | null;
  notes: string | null;
  is_archived: boolean;
};

export type FundRequest = {
  id: string;
  brand_id: string;
  ad_id: string | null;
  amount: number;
  currency: Currency;
  status: "pending" | "funded" | "declined";
  requested_at: string;
  resolved_at: string | null;
  note: string | null;
};

export const AD_STATUS_LABELS: Record<AdStatus, string> = {
  not_started: "Not started",
  set_up: "Set up",
  live: "Live",
  paused: "Paused",
  ended: "Ended",
};

// The buttons offered at each stage: the main one first.
export const AD_MOVES: Record<AdStatus, { to: AdStatus; label: string }[]> = {
  not_started: [{ to: "set_up", label: "Mark as Set up" }],
  set_up: [{ to: "live", label: "Go live" }],
  live: [{ to: "paused", label: "Pause" }, { to: "ended", label: "End" }],
  paused: [{ to: "live", label: "Resume" }, { to: "ended", label: "End" }],
  ended: [],
};

export function adTone(status: AdStatus): { bg: string; fg: string } {
  if (status === "live") return { bg: "#E3F5EA", fg: "#17633A" };
  if (status === "paused") return { bg: "#FFF3D6", fg: "#7A4B00" };
  if (status === "set_up") return { bg: "#E4ECFB", fg: "#1F4A9E" };
  return { bg: "#EEF1F5", fg: "#44516B" };
}

const SYMBOL: Record<Currency, string> = { NGN: "₦", USD: "$" };

// "₦120,000" in full, or "₦1.24m" / "₦860k" when short.
export function money(amount: number, currency: Currency, short = false): string {
  const s = SYMBOL[currency];
  if (!short) return `${s}${Math.round(amount).toLocaleString("en-GB")}`;
  if (amount >= 1_000_000) return `${s}${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 2).replace(/\.?0+$/, "")}m`;
  if (amount >= 1_000) return `${s}${Math.round(amount / 1_000)}k`;
  return `${s}${Math.round(amount)}`;
}

// Total spend per currency, e.g. "₦860k + $120". Naira and Dollars are never added together.
export function spendSummary(ads: Pick<Ad, "spend_to_date" | "currency">[]): string | null {
  const totals = new Map<Currency, number>();
  for (const ad of ads) totals.set(ad.currency, (totals.get(ad.currency) ?? 0) + Number(ad.spend_to_date));
  const parts = (["NGN", "USD"] as Currency[]).filter((c) => (totals.get(c) ?? 0) > 0).map((c) => money(totals.get(c)!, c, true));
  return parts.length ? parts.join(" + ") : null;
}

// Hours since a time, for the 24-hour flags.
export function hoursSince(iso: string, now = Date.now()) {
  return (now - new Date(iso).getTime()) / 3_600_000;
}
