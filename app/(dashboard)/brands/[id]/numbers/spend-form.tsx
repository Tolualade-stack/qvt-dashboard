"use client";

import { useState, useTransition } from "react";
import { money, type Currency } from "@/lib/ads";
import { channelName } from "@/lib/campaign";
import { formatDateTime } from "@/lib/format";
import { saveSpend } from "./actions";

type Theme = { main: string; deep: string; ink: string; soft: string; onMain: string };
type Line = { id: string; channel: string; format: string | null; planned: number; currency: Currency; spent: number | null; updatedAt: string | null; campaign: string | null };

// The weekly spend update: every line of the media plan, its planned amount,
// and a box for what's been spent on it so far. One save for all of them.
export function SpendForm({ brandId, lines, theme }: { brandId: string; lines: Line[]; theme: Theme }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.id, l.spent == null ? "" : String(Math.round(l.spent))])),
  );
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const last = lines.map((l) => l.updatedAt).filter(Boolean).sort().at(-1);

  if (lines.length === 0) {
    return (
      <p className="rounded-2xl bg-mist p-4 text-sm text-muted">
        No media plan lines yet. Once a campaign&apos;s budget lines are in, the weekly spend is entered here against each one.
      </p>
    );
  }

  function save() {
    setMessage(null);
    const changed = lines
      .filter((l) => values[l.id] !== (l.spent == null ? "" : String(Math.round(l.spent))))
      .map((l) => ({ id: l.id, spent: values[l.id].replace(/[,\s₦$]/g, "") }));
    if (changed.some((c) => c.spent !== "" && !(Number(c.spent) >= 0))) {
      setMessage({ ok: false, message: "Use numbers only, e.g. 120000." });
      return;
    }
    if (changed.length === 0) {
      setMessage({ ok: true, message: "Nothing changed." });
      return;
    }
    startTransition(async () => setMessage(await saveSpend(brandId, changed)));
  }

  return (
    <section className="rounded-[20px] p-4" style={{ backgroundColor: theme.soft }}>
      <h2 className="font-display text-xl font-black">Spend so far, against the plan</h2>
      <p className="mt-1 text-[13px] leading-snug text-muted">
        Once a week, enter the total spent so far on each line. The budget spread updates from this.
        {last ? ` Last updated ${formatDateTime(last)}.` : ""}
      </p>
      <ul className="mt-3 space-y-2">
        {lines.map((l) => {
          const typed = Number(values[l.id].replace(/[,\s₦$]/g, ""));
          const pct = values[l.id] && l.planned ? Math.round((typed / l.planned) * 100) : null;
          return (
            <li key={l.id} className="rounded-2xl bg-white p-3">
              <label className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{channelName(l.channel)}{l.format ? ` · ${l.format}` : ""}</span>
                  <span className="block text-xs text-muted">
                    {money(l.planned, l.currency)} planned{l.campaign ? ` · ${l.campaign}` : ""}
                    {pct != null && Number.isFinite(pct) ? ` · ${pct}% used${pct > 100 ? ", over budget" : ""}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-sm font-semibold text-muted">{l.currency === "USD" ? "$" : "₦"}</span>
                  <input
                    inputMode="numeric"
                    placeholder="0"
                    aria-label={`Spent so far on ${channelName(l.channel)} ${l.format ?? ""}`}
                    value={values[l.id]}
                    onChange={(e) => setValues({ ...values, [l.id]: e.target.value })}
                    className="min-h-11 w-28 rounded-xl border border-line px-2.5 text-right font-display text-base font-extrabold"
                    style={pct != null && pct > 100 ? { color: "#A11A1A", borderColor: "#F2B8B8" } : { color: theme.ink }}
                  />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {message && <p role="status" className={`mt-2 text-sm font-medium ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.message}</p>}
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="mt-3 min-h-12 w-full rounded-2xl text-sm font-bold disabled:opacity-60"
        style={{ background: `linear-gradient(135deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}
      >
        {pending ? "Saving…" : "Save this week's spend"}
      </button>
    </section>
  );
}
