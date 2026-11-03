// Headline numbers per channel. Each upload covers a period (e.g. the last 7
// days). A channel shows its latest upload, compared with the one before it;
// "All channels" adds up each channel's latest upload.

export type ChannelMetric = {
  id: string;
  brand_id: string;
  channel: string;
  period_start: string;
  period_end: string;
  impressions: number | null;
  reach: number | null;
  likes: number | null;
  clicks: number | null;
  followers_gained: number | null;
  video_views: number | null;
  spots_aired: number | null;
  source: "manual" | "sheet" | "meta" | "tiktok" | "google_ads" | "other";
  author_name: string;
  created_at: string;
};

export const METRIC_FIELDS = [
  ["impressions", "Impressions"],
  ["reach", "Reach"],
  ["likes", "Likes"],
  ["clicks", "Clicks"],
  ["followers_gained", "Followers gained"],
  ["video_views", "Video views"],
] as const;
export type MetricField = (typeof METRIC_FIELDS)[number][0];

export const SOURCE_NAMES: Record<ChannelMetric["source"], string> = {
  manual: "typed in",
  sheet: "Google Sheet",
  meta: "Meta",
  tiktok: "TikTok",
  google_ads: "Google Ads",
  other: "import",
};

const newestFirst = (a: ChannelMetric, b: ChannelMetric) =>
  b.period_end.localeCompare(a.period_end) || b.created_at.localeCompare(a.created_at);

// The latest and previous upload for each channel.
export function latestByChannel(rows: ChannelMetric[]) {
  const byChannel = new Map<string, { latest: ChannelMetric; previous: ChannelMetric | null }>();
  for (const row of [...rows].sort(newestFirst)) {
    const entry = byChannel.get(row.channel);
    if (!entry) byChannel.set(row.channel, { latest: row, previous: null });
    else if (!entry.previous) entry.previous = row;
  }
  return byChannel;
}

export type MetricSummary = {
  values: Partial<Record<MetricField, number>>;
  deltas: Partial<Record<MetricField, number>>; // % change vs the previous upload
  asOf: string | null;                          // latest period end
  by: string | null;                            // who or what uploaded it
};

function sumField(rows: (ChannelMetric | null)[], field: MetricField): number | undefined {
  const vals = rows.filter((r): r is ChannelMetric => !!r && r[field] != null).map((r) => Number(r[field]));
  return vals.length ? vals.reduce((a, b) => a + b, 0) : undefined;
}

// Summary for one channel, or for all channels together (channel = null).
export function summarise(rows: ChannelMetric[], channel: string | null): MetricSummary {
  const map = latestByChannel(rows.filter((r) => r.channel !== "tv" && r.channel !== "radio"));
  const entries = channel ? (map.has(channel) ? [map.get(channel)!] : []) : [...map.values()];
  const latest = entries.map((e) => e.latest);
  const previous = entries.map((e) => e.previous);
  const values: MetricSummary["values"] = {};
  const deltas: MetricSummary["deltas"] = {};
  for (const [field] of METRIC_FIELDS) {
    const now = sumField(latest, field);
    if (now === undefined) continue;
    values[field] = now;
    const before = sumField(previous, field);
    if (before !== undefined && before !== 0 && previous.every((p) => p)) deltas[field] = ((now - before) / Math.abs(before)) * 100;
  }
  const newest = latest.sort((a, b) => b.period_end.localeCompare(a.period_end))[0];
  return {
    values,
    deltas,
    asOf: newest?.period_end ?? null,
    by: newest ? (newest.source === "manual" ? newest.author_name : SOURCE_NAMES[newest.source]) : null,
  };
}

// 1820000 -> "1.82m", 48300 -> "48.3k", 9410 -> "9,410".
export function compact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m`;
  if (abs >= 100_000) return `${sign}${Math.round(abs / 1_000)}k`;
  if (abs >= 10_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${sign}${Math.round(abs).toLocaleString("en-GB")}`;
}

export function formatDelta(pct: number): string {
  const rounded = Math.round(pct);
  return `${rounded >= 0 ? "+" : "−"}${Math.abs(rounded)}%`;
}

// Spots aired this month, per traditional channel.
export function spotsThisMonth(rows: ChannelMetric[], monthFirstDay: string) {
  const sum = (ch: string) =>
    rows.filter((r) => r.channel === ch && r.period_end >= monthFirstDay && r.spots_aired != null).reduce((a, r) => a + Number(r.spots_aired), 0);
  return { tv: sum("tv"), radio: sum("radio") };
}
