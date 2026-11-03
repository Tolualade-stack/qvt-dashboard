import { money } from "@/lib/ads";
import type { allocate } from "@/lib/budget";

type Theme = { main: string; deep: string; ink: string; soft: string; onMain: string };

// The budget spread: each line of the media plan as a bar, with actual ad spend
// filling it as ads are updated. Over budget shows in red.
export function BudgetSpread({
  spread,
  theme,
  channelLabel,
}: {
  spread: ReturnType<typeof allocate>;
  theme: Theme;
  channelLabel: (id: string) => string;
}) {
  const { lines, unplanned, totals } = spread;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[...totals.entries()].map(([currency, t]) => (
          <div key={currency} className="flex-1 rounded-[18px] p-3.5" style={{ backgroundColor: theme.soft }}>
            <div className="text-xs text-muted">Spent of planned ({currency === "NGN" ? "₦" : "$"})</div>
            <div className="font-display text-2xl leading-tight font-black" style={{ color: theme.ink }}>
              {money(t.spent, currency, true)} <span className="text-sm opacity-70">of {money(t.planned, currency, true)}</span>
            </div>
            <div className="text-xs font-semibold text-muted">{t.planned ? `${Math.round((t.spent / t.planned) * 100)}% used` : ""}</div>
          </div>
        ))}
      </div>
      <ul className="space-y-3">
        {lines.map((line) => {
          const pct = line.planned_amount ? (line.spent / line.planned_amount) * 100 : 0;
          const over = pct > 100;
          return (
            <li key={line.id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">
                  {channelLabel(line.channel)}
                  {line.format ? <span className="font-normal text-muted"> · {line.format}</span> : null}
                </span>
                <span className={`text-xs font-semibold ${over ? "text-red-700" : "text-muted"}`}>
                  {money(line.spent, line.currency)} of {money(line.planned_amount, line.currency)}
                  {over ? " · over budget" : ""}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: theme.soft }}>
                <div className="h-2.5 rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: over ? "#C62828" : theme.main }} />
              </div>
            </li>
          );
        })}
      </ul>
      {[...unplanned.entries()].map(([currency, amount]) => (
        <p key={currency} className="rounded-2xl bg-amber-100 p-3 text-sm text-amber-950">
          <b>{money(amount, currency)}</b> spent on ads that aren&apos;t in the media plan.
        </p>
      ))}
    </div>
  );
}
