"use client";

import { useState } from "react";
import { AD_STATUS_LABELS, adTone, type AdStatus } from "@/lib/ads";
import { compact, formatDelta, type MetricField, type MetricSummary } from "@/lib/metrics";
import { shortDate } from "@/lib/format";

// A world's Performance section: tap a channel to see its headline numbers and
// its ads by format. Reach, impressions and the rest arrive with live numbers
// (Phase 3); ad spend and ad status come from the ads tracker now.

type Theme = { main: string; deep: string; ink: string; soft: string; onMain: string };
type Channel = { id: string; label: string; formats: readonly string[] };
export type AdSummary = { channel: string; format: string | null; status: AdStatus };
export type AdsOverview = { live: number; paused: number; issues: number; pendingFunds: number; lateFunds: number };

const METRICS: [MetricField, string][] = [
  ["impressions", "Impressions"],
  ["likes", "Likes"],
  ["clicks", "Clicks"],
  ["followers_gained", "Followers gained"],
  ["video_views", "Video views"],
];

export function WorldPerformance({
  channels,
  theme,
  ads,
  spendByChannel,
  overview,
  metrics,
}: {
  channels: Channel[];
  theme: Theme;
  ads: AdSummary[];
  spendByChannel: Record<string, string | null>; // "all" plus each channel id
  overview: AdsOverview;
  metrics: Record<string, MetricSummary>;        // "all" plus each channel id
}) {
  const [selected, setSelected] = useState("all");
  const current = channels.find((c) => c.id === selected);
  const channelName = current?.label ?? "All channels";
  const tabs = [{ id: "all", label: "All" }, ...channels];
  const spend = spendByChannel[selected] ?? null;
  const numbers = metrics[selected] ?? { values: {}, deltas: {}, asOf: null, by: null };
  const delta = (field: MetricField) => (numbers.deltas[field] !== undefined ? `${formatDelta(numbers.deltas[field]!)} vs previous` : "");

  // For one format: the most important status among its ads (live first).
  const formatStatus = (channel: string, format: string): { label: string; status: AdStatus } => {
    const matching = ads.filter((a) => a.channel === channel && a.format === format);
    for (const s of ["live", "paused", "set_up", "ended"] as AdStatus[]) {
      const n = matching.filter((a) => a.status === s).length;
      if (n) return { label: n > 1 ? `${n} ${AD_STATUS_LABELS[s].toLowerCase()}` : AD_STATUS_LABELS[s], status: s };
    }
    return { label: "Not started", status: "not_started" };
  };

  return (
    <>
      <section aria-label="Performance" className="mt-6">
        <h2 className="mb-3 font-display text-2xl font-black">Performance</h2>
        {channels.length > 0 && (
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1.5">
            {tabs.map((tab) => {
              const on = tab.id === selected;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(tab.id)}
                  className="min-h-[42px] shrink-0 rounded-full px-4 text-sm font-bold transition"
                  style={on ? { backgroundColor: theme.main, color: theme.onMain } : { backgroundColor: theme.soft, color: theme.ink }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div
            className="relative col-span-2 overflow-hidden rounded-[22px] p-5"
            style={{ background: `linear-gradient(140deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}
          >
            <div className="text-[13px] font-semibold opacity-85">Reach · {channelName}</div>
            <div className="font-display text-[46px] leading-tight font-black">{numbers.values.reach !== undefined ? compact(numbers.values.reach) : "–"}</div>
            <div className="text-[13px] font-semibold opacity-85">
              {numbers.values.reach !== undefined ? delta("reach") || "First upload" : "Appears once numbers are uploaded"}
            </div>
          </div>
          {METRICS.map(([field, label]) => (
            <div key={field} className="rounded-[18px] p-3.5" style={{ backgroundColor: theme.soft }}>
              <div className="text-xs text-muted">{label}</div>
              <div className="font-display text-[26px] leading-tight font-black" style={{ color: theme.ink }}>
                {numbers.values[field] !== undefined ? compact(numbers.values[field]!) : "–"}
              </div>
              <div className="text-xs font-semibold text-muted">{delta(field)}</div>
            </div>
          ))}
          <div className="rounded-[18px] p-3.5" style={{ backgroundColor: theme.soft }}>
            <div className="text-xs text-muted">Ad spend</div>
            <div className="font-display text-[26px] leading-tight font-black" style={{ color: theme.ink }}>{spend ?? "–"}</div>
            <div className="text-xs font-semibold text-muted">{spend ? "from the ads tracker" : "no spend logged"}</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          {numbers.asOf ? `Numbers as of ${shortDate(numbers.asOf)} · uploaded by ${numbers.by}` : "No numbers uploaded yet. Add them on the Update screen, under Numbers."}
        </p>
      </section>

      <section className="mt-5 rounded-[22px] border-[1.5px] p-5" style={{ borderColor: theme.soft }}>
        <h2 className="text-base font-bold">Ads by format · {channelName}</h2>
        {current ? (
          <ul className="mt-1">
            {current.formats.map((format) => {
              const { label, status } = formatStatus(current.id, format);
              const tone = adTone(status);
              return (
                <li key={format} className="flex items-center justify-between gap-3 border-t py-3" style={{ borderColor: theme.soft }}>
                  <span className="text-sm font-semibold">{format}</span>
                  <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: tone.bg, color: tone.fg }}>{label}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="mt-1">
            {[
              ["Live ads", overview.live ? `${overview.live} live` : "None live", overview.live ? "live" : "not_started"],
              ["Paused", overview.paused ? `${overview.paused} paused` : "None", overview.paused ? "paused" : "not_started"],
              ["Issues raised", overview.issues ? `${overview.issues} open` : "None", overview.issues ? "paused" : "not_started"],
              [
                "Fund requests",
                overview.pendingFunds ? `${overview.pendingFunds} pending${overview.lateFunds ? `, ${overview.lateFunds} over 24 h` : ""}` : "None pending",
                overview.lateFunds ? "late" : overview.pendingFunds ? "paused" : "not_started",
              ],
            ].map(([name, label, status]) => {
              const tone = status === "late" ? { bg: "#FDE7E7", fg: "#A11A1A" } : adTone(status as AdStatus);
              return (
                <li key={name} className="flex items-center justify-between gap-3 border-t py-3" style={{ borderColor: theme.soft }}>
                  <span className="text-sm font-semibold">{name}</span>
                  <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: tone.bg, color: tone.fg }}>{label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
