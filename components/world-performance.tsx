"use client";

import { useState } from "react";

// A world's Performance section: tap a channel to see its headline numbers and
// its ad formats. Numbers show "–" until they are uploaded (Phase 3); the layout
// and channels are real.

type Theme = { main: string; deep: string; ink: string; soft: string; onMain: string };
type Channel = { id: string; label: string; formats: readonly string[] };

const METRICS = ["Impressions", "Likes", "Clicks", "Followers gained", "Video views", "Ad spend"];

export function WorldPerformance({ channels, theme }: { channels: Channel[]; theme: Theme }) {
  const [selected, setSelected] = useState("all");
  const current = channels.find((c) => c.id === selected);
  const channelName = current?.label ?? "All channels";
  const tabs = [{ id: "all", label: "All" }, ...channels];

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
            <div className="font-display text-[46px] leading-tight font-black">–</div>
            <div className="text-[13px] font-semibold opacity-85">Appears once numbers are uploaded</div>
          </div>
          {METRICS.map((label) => (
            <div key={label} className="rounded-[18px] p-3.5" style={{ backgroundColor: theme.soft }}>
              <div className="text-xs text-muted">{label}</div>
              <div className="font-display text-[26px] leading-tight font-black" style={{ color: theme.ink }}>–</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">No numbers uploaded yet. They arrive with live numbers in Phase 3.</p>
      </section>

      <section className="mt-5 rounded-[22px] border-[1.5px] p-5" style={{ borderColor: theme.soft }}>
        <h2 className="text-base font-bold">Ads by format · {channelName}</h2>
        {current ? (
          <ul className="mt-1">
            {current.formats.map((format) => (
              <li key={format} className="flex items-center justify-between gap-3 border-t py-3" style={{ borderColor: theme.soft }}>
                <span className="text-sm font-semibold">{format}</span>
                <span className="rounded-full bg-mist px-2.5 py-1 text-xs font-bold text-muted">Not started</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {channels.length
              ? `No ads live yet across ${channels.length} channels. Tap a channel to see its ad formats.`
              : "No digital channels chosen. Add them with Edit world."}
          </p>
        )}
      </section>
    </>
  );
}
