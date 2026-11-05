"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { checkInNothingChanged } from "../work/actions";

export function CheckInForm({ name, next, alreadyDone, time }: { name: string; next: { title: string; due: string }[]; alreadyDone: boolean; time: string }) {
  const [done, setDone] = useState(alreadyDone);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function nothing() {
    setProblem(null);
    startTransition(async () => {
      const result = await checkInNothingChanged();
      if (result.ok) setDone(true);
      else setProblem(result.message);
    });
  }

  return (
    <div className="prime-gradient -mx-5 -mt-4 flex min-h-[calc(100dvh-7rem)] flex-col px-5 pt-5 pb-6 text-white sm:mx-0 sm:mt-0 sm:rounded-[30px]">
      <div className="flex items-center justify-between gap-3">
        <Link href="/work" aria-label="Back to My work" className="flex size-11 items-center justify-center rounded-[14px] bg-white/15">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        </Link>
        <span className="text-[13px] font-semibold text-[#DCE4F7]">{time}</span>
      </div>

      {done ? (
        <div role="status" className="flex flex-1 flex-col">
          <span className="mt-14 flex size-24 items-center justify-center rounded-[32px] bg-white text-navy">
            <svg aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
          </span>
          <h1 className="mt-5 font-display text-[46px] leading-none font-black">Thanks, {name}</h1>
          <p className="mt-2 text-base leading-relaxed text-[#DCE4F7]">You&apos;re marked as checked today, so nobody needs to chase you.</p>
          <div className="mt-6 rounded-[20px] bg-white/10 p-4">
            <div className="text-[11px] font-bold tracking-[0.12em] text-[#B9C8EC]">WHAT THE ACCOUNT LEAD SEES</div>
            <div className="mt-1.5 text-[15px]"><b>{name}</b> checked in: nothing changed.</div>
          </div>
          <Link href="/work" className="mt-auto flex min-h-[60px] items-center justify-center rounded-[22px] bg-white font-display text-xl font-black text-navy">Back to My work</Link>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <h1 className="mt-10 font-display text-[52px] leading-[0.98] font-black tracking-tight">Anything change today?</h1>
          <p className="mt-2.5 text-base text-[#DCE4F7]">Hello, {name}.</p>
          {next.length > 0 && (
            <div className="mt-6 rounded-[22px] bg-white/10 px-4 py-1.5">
              <div className="pt-2.5 pb-1.5 text-[11px] font-bold tracking-[0.12em] text-[#B9C8EC]">YOUR NEXT {next.length}</div>
              {next.map((n) => (
                <div key={n.title + n.due} className="flex items-center justify-between gap-2.5 border-t border-white/15 py-2.5">
                  <span className="text-sm font-semibold">{n.title}</span>
                  <span className="shrink-0 text-[13px] text-[#DCE4F7]">{n.due}</span>
                </div>
              ))}
            </div>
          )}
          {problem && <p role="alert" className="mt-3 rounded-2xl bg-white p-3 text-sm font-medium text-red-800">{problem}</p>}
          <div className="mt-auto flex flex-col gap-2.5 pt-7">
            <button type="button" disabled={pending} onClick={nothing} className="min-h-[66px] rounded-[22px] bg-white font-display text-[22px] font-black text-navy shadow-2xl disabled:opacity-60">
              {pending ? "Saving…" : "Nothing changed"}
            </button>
            <Link href="/update" className="flex min-h-14 items-center justify-center rounded-[20px] border-[1.5px] border-white/40 text-base font-semibold">Yes, update something</Link>
          </div>
        </div>
      )}
    </div>
  );
}
