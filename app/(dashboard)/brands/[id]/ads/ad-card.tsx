"use client";

import Link from "next/link";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { moveAd, raiseIssue, requestFunds, resolveFunds, resolveIssue, updateSpend } from "./actions";
import { AD_MOVES, AD_STATUS_LABELS, adTone, hoursSince, money, type Ad, type AdStatus, type FundRequest } from "@/lib/ads";
import { timeAgo } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import { FormMessage, inputClass } from "@/components/ui";

type Theme = { main: string; deep: string; ink: string; soft: string; onMain: string };
type Tool = "spend" | "issue" | "funds" | null;

// One ad on the Update screen: its stage with one-tap moves, spend against
// budget, and quick tools for spend, issues and fund requests.
export function AdCard({
  ad,
  funds,
  theme,
  channelLabel,
  ownerName,
  canEdit,
}: {
  ad: Ad;
  funds: FundRequest[];
  theme: Theme;
  channelLabel: string;
  ownerName: string | null;
  canEdit: boolean;
}) {
  const [status, setOptimisticStatus] = useOptimistic<AdStatus>(ad.status);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<FormState>(null);
  const [tool, setTool] = useState<Tool>(null);
  const tone = adTone(status);

  const [spendState, spendAction, spendPending] = useActionState(updateSpend.bind(null, ad.id, ad.brand_id), null);
  const [issueState, issueAction, issuePending] = useActionState(raiseIssue.bind(null, ad.id, ad.brand_id), null);
  const [fundState, fundAction, fundPending] = useActionState(requestFunds.bind(null, ad.id, ad.brand_id), null);

  const run = (task: () => Promise<FormState>, optimistic?: AdStatus) => {
    setMessage(null);
    startTransition(async () => {
      if (optimistic) setOptimisticStatus(optimistic);
      const result = await task();
      if (result && !result.ok) setMessage(result);
    });
  };

  const budget = ad.budget ? Number(ad.budget) : null;
  const spend = Number(ad.spend_to_date);
  const issueHours = ad.issue_raised_at ? hoursSince(ad.issue_raised_at) : 0;
  const moves = AD_MOVES[status];
  const toolButton = (key: Exclude<Tool, null>, label: string) => (
    <button
      type="button"
      onClick={() => setTool(tool === key ? null : key)}
      aria-expanded={tool === key}
      className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${tool === key ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
    >
      {label}
    </button>
  );

  return (
    <article className="overflow-hidden rounded-[20px] border border-line bg-white">
      <div className="flex">
        <span aria-hidden="true" className="w-1.5 shrink-0" style={{ backgroundColor: theme.main }} />
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/brands/${ad.brand_id}/ads/${ad.id}`} className="min-w-0">
              <span className="block text-[15px] leading-snug font-semibold">{ad.name}</span>
              <span className="block text-xs text-muted">{[channelLabel, ad.format, ownerName].filter(Boolean).join(" · ")}</span>
            </Link>
            <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: tone.bg, color: tone.fg }}>
              {AD_STATUS_LABELS[status]}
            </span>
          </div>

          {(budget || spend > 0) && (
            <div>
              <div className="flex justify-between text-xs">
                <span className="font-semibold">
                  {money(spend, ad.currency)} spent{budget ? ` of ${money(budget, ad.currency)}` : ""}
                </span>
                {ad.spend_updated_at && spend > 0 && <span className="text-muted">as of {timeAgo(ad.spend_updated_at)}</span>}
              </div>
              {budget && (
                <div className="mt-1.5 h-2 rounded-full" style={{ backgroundColor: theme.soft }}>
                  <div className="h-2 rounded-full" style={{ width: `${Math.min(100, (spend / budget) * 100)}%`, backgroundColor: theme.main }} />
                </div>
              )}
            </div>
          )}

          {ad.issue_raised_at && (
            <div className={`rounded-2xl p-3 text-sm ${issueHours > 24 ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-950"}`}>
              <div className="font-bold">
                Issue raised {timeAgo(ad.issue_raised_at)} ·{" "}
                {issueHours > 24 ? "past 24 h, escalate now" : `escalate in ${Math.max(1, Math.ceil(24 - issueHours))} h if not fixed`}
              </div>
              <div className="mt-0.5">{ad.issue_note}</div>
              {canEdit && (
                <button type="button" disabled={pending} onClick={() => run(() => resolveIssue(ad.id, ad.brand_id))} className="mt-2 min-h-9 rounded-full bg-white px-3 text-xs font-bold">
                  Mark resolved
                </button>
              )}
            </div>
          )}

          {funds.map((f) => {
            const late = hoursSince(f.requested_at) > 24;
            return (
              <div key={f.id} className={`rounded-2xl p-3 text-sm ${late ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-950"}`}>
                <div className="font-bold">
                  {money(Number(f.amount), f.currency)} requested {timeAgo(f.requested_at)}
                  {late ? " · pending over 24 h" : " · pending"}
                </div>
                {f.note && <div className="mt-0.5">{f.note}</div>}
                {canEdit && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={pending} onClick={() => run(() => resolveFunds(f.id, ad.brand_id, "funded"))} className="min-h-9 rounded-full bg-white px-3 text-xs font-bold">
                      Funded
                    </button>
                    <button type="button" disabled={pending} onClick={() => run(() => resolveFunds(f.id, ad.brand_id, "declined"))} className="min-h-9 rounded-full px-3 text-xs font-semibold underline">
                      Declined
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {canEdit && moves.length > 0 && (
            <div className="flex gap-2">
              {moves.map((move, i) => (
                <button
                  key={move.to}
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => moveAd(ad.id, ad.brand_id, move.to), move.to)}
                  className={`min-h-12 rounded-[14px] text-sm font-bold transition active:scale-[0.98] disabled:opacity-70 ${i === 0 ? "flex-1" : "border border-line bg-white px-5"}`}
                  style={i === 0 ? { background: `linear-gradient(135deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain } : undefined}
                >
                  {move.label}
                </button>
              ))}
            </div>
          )}

          {canEdit && status !== "ended" && (
            <div className="flex flex-wrap gap-2">
              {toolButton("spend", "Update spend")}
              {!ad.issue_raised_at && toolButton("issue", "Raise issue")}
              {toolButton("funds", "Request funds")}
            </div>
          )}

          {tool === "spend" && (
            <form action={spendAction} className="flex gap-2">
              <input name="spend" inputMode="decimal" defaultValue={spend || ""} placeholder={`Spend so far (${ad.currency === "USD" ? "$" : "₦"})`} aria-label="Spend so far" className={`${inputClass} min-h-11`} />
              <button type="submit" disabled={spendPending} className="min-h-11 shrink-0 rounded-2xl bg-ink px-4 text-sm font-bold text-white">Save</button>
            </form>
          )}
          {tool === "issue" && (
            <form action={issueAction} className="flex gap-2">
              <input name="issue_note" placeholder="What's wrong? e.g. CTR below target" aria-label="What's wrong" className={`${inputClass} min-h-11`} />
              <button type="submit" disabled={issuePending} className="min-h-11 shrink-0 rounded-2xl bg-ink px-4 text-sm font-bold text-white">Raise</button>
            </form>
          )}
          {tool === "funds" && (
            <form action={fundAction} className="space-y-2">
              <div className="flex gap-2">
                <select name="currency" defaultValue={ad.currency} aria-label="Currency" className={`${inputClass} min-h-11 w-20`}>
                  <option value="NGN">₦</option>
                  <option value="USD">$</option>
                </select>
                <input name="amount" inputMode="decimal" placeholder="Amount needed" aria-label="Amount needed" className={`${inputClass} min-h-11`} />
              </div>
              <div className="flex gap-2">
                <input name="note" placeholder="Note for Finance (optional)" aria-label="Note for Finance" className={`${inputClass} min-h-11`} />
                <button type="submit" disabled={fundPending} className="min-h-11 shrink-0 rounded-2xl bg-ink px-4 text-sm font-bold text-white">Request</button>
              </div>
            </form>
          )}

          <FormMessage state={message ?? spendState ?? issueState ?? fundState} />
        </div>
      </div>
    </article>
  );
}
