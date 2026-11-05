"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { worldTheme } from "@/lib/colour";
import { AREAS } from "@/lib/campaign-setup";
import type { WorkAction, WorkItem, WorkKind } from "@/lib/work-items";
import { quickNote, quickUpdate } from "../work/actions";

// The + button: what happened, then which one. Tap the item and it's saved.

const CHOICES: { label: string; kinds: WorkKind[]; action: (item: WorkItem) => WorkAction; area?: string; question: string }[] = [
  { label: "Posted", kinds: ["content"], action: () => "content:posted", area: "content", question: "Which one was posted?" },
  { label: "Ad live", kinds: ["ad"], action: () => "ad:live", area: "ads", question: "Which ad went live?" },
  { label: "Approved", kinds: ["content"], action: () => "content:approved", area: "content", question: "Which one was approved?" },
  { label: "Report sent", kinds: ["report"], action: () => "report:sent", area: "reports", question: "Which report went out?" },
  { label: "Issue", kinds: ["content", "ad", "report", "asset", "deliverable", "numbers"], action: () => "issue:raise", question: "Which one has the issue?" },
  { label: "Need funds", kinds: ["ad"], action: () => "ad:funds", area: "ads", question: "Which ad needs funds?" },
];

export function QuickUpdate({ items, brands, elsewhere }: { items: WorkItem[]; brands: { id: string; name: string }[]; elsewhere: { area: string; name: string }[] }) {
  const [picked, setPicked] = useState(0);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [noteBrand, setNoteBrand] = useState(brands[0]?.id ?? "");
  const [saved, setSaved] = useState<{ title: string; message: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const choice = CHOICES[picked];
  const fits = items.filter((i) => choice.kinds.includes(i.kind) && !(i.issueOpen && choice.label === "Issue"));
  const coveredBy = choice.area ? elsewhere.find((e) => e.area === choice.area)?.name : undefined;

  function save(item: WorkItem) {
    setProblem(null);
    startTransition(async () => {
      const result = await quickUpdate({
        kind: item.kind,
        id: item.id,
        brandId: item.brandId,
        campaignId: item.campaignId,
        title: item.title,
        action: choice.action(item),
        note,
        amount,
        currency,
      });
      if (!result.ok) return setProblem(result.message);
      setSaved({ title: `${choice.label} · ${item.title}`, message: result.message });
      setNote("");
      setAmount("");
    });
  }

  function saveNote() {
    setProblem(null);
    startTransition(async () => {
      const result = await quickNote(noteBrand, note);
      if (!result.ok) return setProblem(result.message);
      setSaved({ title: "Added to the log", message: result.message });
      setNote("");
    });
  }

  if (saved) {
    return (
      <section role="status" className="pt-10 text-center">
        <span className="prime-gradient mx-auto flex size-24 items-center justify-center rounded-[32px] text-white">
          <svg aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
        </span>
        <h1 className="mt-5 font-display text-[34px] leading-none font-black text-navy">Saved</h1>
        <p className="mt-1.5 text-base leading-relaxed">{saved.title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">{saved.message}</p>
        <button type="button" onClick={() => setSaved(null)} className="mt-6 min-h-[52px] w-full rounded-[18px] border-[1.5px] border-line bg-white text-[15px] font-semibold">Update something else</button>
        <Link href="/work" className="prime-gradient mt-2.5 flex min-h-[58px] items-center justify-center rounded-[20px] font-display text-lg font-extrabold text-white">Back to My work</Link>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/work" aria-label="Back to My work" className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-mist">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        </Link>
        <div className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">Update</div>
      </div>

      <div>
        <h1 className="mb-3.5 font-display text-[34px] leading-none font-black tracking-tight text-navy">What happened?</h1>
        <div className="grid grid-cols-2 gap-2">
          {CHOICES.map((c, i) => {
            const on = picked === i;
            const warn = c.label === "Issue" || c.label === "Need funds";
            return (
              <button
                key={c.label}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(i)}
                className="min-h-[60px] rounded-[18px] border-[1.5px] text-[15px] font-bold"
                style={on ? { backgroundColor: "#0B1F4B", color: "#FFFFFF", borderColor: "#0B1F4B" } : warn ? { backgroundColor: "#FFF7E8", color: "#8A3B00", borderColor: "#F5D9A6" } : { backgroundColor: "#F3F5FA", color: "#000000", borderColor: "#F3F5FA" }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {choice.label === "Need funds" && (
        <div className="flex gap-2">
          <input aria-label="Amount needed" inputMode="numeric" placeholder="How much is needed?" value={amount} onChange={(e) => setAmount(e.target.value)} className="min-h-[50px] min-w-0 flex-1 rounded-[14px] border border-line px-3 text-sm" />
          <select aria-label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value as "NGN" | "USD")} className="min-h-[50px] rounded-[14px] border border-line px-2 text-sm">
            <option value="NGN">₦</option>
            <option value="USD">$</option>
          </select>
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold">Or say it in your own words</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Client wants a brighter thumbnail" className="min-h-[50px] w-full rounded-[14px] border border-line px-3 text-sm" />
      </label>

      <section>
        <h2 className="font-display text-[22px] font-black">{choice.question}</h2>
        <p className="mt-0.5 mb-2.5 text-[13px] text-muted">Your work, soonest first. Tap one and it&apos;s saved.</p>
        {problem && <p role="alert" className="mb-2 rounded-2xl bg-red-50 p-3 text-sm font-medium text-red-800">{problem}</p>}
        <div className="space-y-2">
          {fits.map((item) => {
            const theme = worldTheme(item.colour);
            return (
              <button
                key={item.key}
                type="button"
                disabled={pending}
                onClick={() => save(item)}
                className="flex min-h-16 w-full items-center gap-3 rounded-[18px] border-[1.5px] px-3.5 py-2.5 text-left disabled:opacity-50"
                style={{ backgroundColor: theme.soft, borderColor: `${theme.main}33` }}
              >
                <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: theme.main }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{item.title}</span>
                  <span className="block text-xs text-muted">{item.where}</span>
                </span>
                <span className="shrink-0 font-display text-sm font-extrabold" style={{ color: theme.ink }}>{item.dueLabel}</span>
              </button>
            );
          })}
          {fits.length === 0 && (
            <p className="rounded-[18px] bg-mist p-3.5 text-sm leading-relaxed">
              None of your work fits this.{coveredBy && choice.area ? ` ${AREAS[choice.area]?.label ?? "This"} is covered by ${coveredBy}.` : ""} You can still add a note below and it goes in the log.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-[18px] border-[1.5px] border-dashed border-line p-3.5">
        <div className="text-sm font-bold">Something else? Post it as a note</div>
        <div className="mt-2 flex gap-2">
          <select aria-label="Which brand" value={noteBrand} onChange={(e) => setNoteBrand(e.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-white px-2 text-sm">
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button type="button" disabled={pending || !noteBrand} onClick={saveNote} className="min-h-11 shrink-0 rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50">Post note</button>
        </div>
        <p className="mt-1 text-xs text-muted">Uses the words you typed above.</p>
      </section>
    </div>
  );
}
