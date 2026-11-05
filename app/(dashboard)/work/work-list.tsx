"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { worldTheme } from "@/lib/colour";
import type { WorkChip, WorkGroup, WorkItem } from "@/lib/work-items";
import { quickUpdate, undoUpdate, type Undo } from "./actions";

type Done = { key: string; title: string; brandId: string; message: string; undo?: Undo };

// My work: tap an item, tap what happened. Saved straight away, with an Undo.
export function WorkList({ groups, readOnly }: { groups: WorkGroup[]; readOnly: boolean }) {
  const first = groups[0]?.items[0]?.key ?? null;
  const [open, setOpen] = useState<string | null>(first);
  const [note, setNote] = useState("");
  const [fundsFor, setFundsFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [done, setDone] = useState<Done[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function tap(item: WorkItem, chip: WorkChip) {
    setProblem(null);
    if (chip.action === "ad:funds" && fundsFor !== item.key) {
      setFundsFor(item.key);
      return;
    }
    startTransition(async () => {
      const result = await quickUpdate({
        kind: item.kind,
        id: item.id,
        brandId: item.brandId,
        campaignId: item.campaignId,
        title: item.title,
        action: chip.action,
        note,
        amount,
        currency,
      });
      if (!result.ok) {
        setProblem(result.message);
        return;
      }
      setDone((list) => [{ key: `${item.key}-${Date.now()}`, title: item.title, brandId: item.brandId, message: result.message, undo: result.undo }, ...list]);
      setOpen(null);
      setNote("");
      setAmount("");
      setFundsFor(null);
    });
  }

  function undo(entry: Done) {
    if (!entry.undo) return;
    startTransition(async () => {
      const result = await undoUpdate(entry.brandId, entry.undo!);
      if (result.ok) setDone((list) => list.filter((d) => d.key !== entry.key));
      else setProblem(result.message);
    });
  }

  return (
    <div className="space-y-5">
      {problem && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-800">{problem}</p>}

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold tracking-[0.12em] text-[#17633A] uppercase">Updated just now</h2>
          <div className="space-y-2" role="status">
            {done.map((d) => (
              <div key={d.key} className="flex items-center gap-2.5 rounded-[18px] bg-[#E3F5EA] py-2 pr-2 pl-3.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{d.title}</div>
                  <div className="text-xs leading-snug text-[#17633A]">{d.message}</div>
                </div>
                {d.undo && (
                  <button type="button" disabled={pending} onClick={() => undo(d)} className="min-h-11 shrink-0 rounded-xl bg-white px-3 text-[13px] font-semibold">Undo</button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.map((group) => (
        <section key={group.label}>
          <h2 className={`mb-2 text-xs font-bold tracking-[0.12em] uppercase ${group.label === "Late" ? "text-[#A11A1A]" : "text-muted"}`}>{group.label}</h2>
          <div className="space-y-2.5">
            {group.items.map((item) => {
              const theme = worldTheme(item.colour);
              const isOpen = open === item.key && !readOnly;
              return (
                <article key={item.key} className="overflow-hidden rounded-[20px] border-[1.5px]" style={{ borderColor: isOpen ? theme.main : `${theme.main}33`, backgroundColor: theme.soft }}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    disabled={readOnly}
                    onClick={() => {
                      setOpen(isOpen ? null : item.key);
                      setNote("");
                      setFundsFor(null);
                    }}
                    className="flex min-h-[76px] w-full items-center gap-3 px-3.5 py-3 text-left"
                  >
                    <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: theme.main }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold">{item.title}</span>
                      <span className="mt-px block text-xs leading-snug text-muted">{item.where}</span>
                      {item.coverName && readOnly && <span className="block text-xs text-muted">Covered by {item.coverName}</span>}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-display text-sm font-extrabold" style={{ color: theme.ink }}>{item.dueLabel}</span>
                      <span className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ backgroundColor: item.statusTone.bg, color: item.statusTone.fg }}>{item.status}</span>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-3.5 pb-3.5">
                      <div className="grid grid-cols-2 gap-2">
                        {item.chips.map((chip) =>
                          chip.action === "numbers:add" ? (
                            <Link key={chip.action} href={item.openHref ?? "#"} className="flex min-h-[52px] items-center justify-center rounded-2xl border-[1.5px] text-center text-sm font-bold" style={{ backgroundColor: theme.main, color: theme.onMain, borderColor: theme.main }}>
                              {chip.label}
                            </Link>
                          ) : (
                            <button
                              key={chip.action}
                              type="button"
                              disabled={pending}
                              onClick={() => tap(item, chip)}
                              className="min-h-[52px] rounded-2xl border-[1.5px] px-2.5 text-sm font-bold transition disabled:opacity-50"
                              style={
                                chip.tone === "main"
                                  ? { backgroundColor: theme.main, color: theme.onMain, borderColor: theme.main }
                                  : chip.tone === "warn"
                                    ? { backgroundColor: "#FFF7E8", color: "#8A3B00", borderColor: "#F5D9A6" }
                                    : { backgroundColor: "#FFFFFF", color: "#000000", borderColor: `${theme.main}33` }
                              }
                            >
                              {chip.label}
                            </button>
                          ),
                        )}
                      </div>
                      {fundsFor === item.key && (
                        <div className="mt-2 flex gap-2 rounded-2xl bg-white p-2">
                          <input aria-label="Amount needed" inputMode="numeric" placeholder="How much?" value={amount} onChange={(e) => setAmount(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3 text-sm" />
                          <select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as "NGN" | "USD")} className="min-h-11 rounded-xl border border-line px-2 text-sm">
                            <option value="NGN">₦</option>
                            <option value="USD">$</option>
                          </select>
                          <span className="sr-only">Then tap Need funds again to send.</span>
                        </div>
                      )}
                      {fundsFor === item.key && <p className="mt-1 text-xs text-muted">Enter the amount, then tap Need funds again to send.</p>}
                      <input
                        aria-label="Add a note"
                        placeholder="Add a note (optional)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="mt-2 min-h-[46px] w-full rounded-[14px] border bg-white px-3 text-sm"
                        style={{ borderColor: `${theme.main}33` }}
                      />
                      {item.openHref && (
                        <Link href={item.openHref} className="mt-1 inline-flex min-h-10 items-center text-[13px] font-semibold underline" style={{ color: theme.ink }}>
                          See all the detail
                        </Link>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
