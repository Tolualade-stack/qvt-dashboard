"use client";

import { useState, useTransition } from "react";
import type { worldTheme } from "@/lib/colour";
import { startAfresh } from "./remove-actions";

// "Start afresh" at the bottom of a world (Admin only). It clears the old work
// and history but keeps the world, so it opens a box that spells out what goes
// and what stays, and asks for the brand's name before the button works.
export function StartAfreshForm({ brandId, brandName, theme }: { brandId: string; brandName: string; theme: ReturnType<typeof worldTheme> }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = typed.trim().toLowerCase() === brandName.trim().toLowerCase();

  function close() {
    setOpen(false);
    setTyped("");
  }

  return (
    <section className="mt-3.5 mb-6 rounded-[22px] border-[1.5px] p-5" style={{ borderColor: theme.soft }}>
      <h2 className="text-base font-bold">Start afresh</h2>
      <p className="mt-1 text-sm text-muted">Clear old test work and history, and keep this world as it is.</p>
      {message?.ok && <p role="status" className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{message.message}</p>}

      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setMessage(null); }}
          className="mt-3 min-h-11 rounded-2xl border-[1.5px] px-4 text-sm font-bold"
          style={{ borderColor: theme.main, color: theme.ink }}
        >
          Start {brandName} afresh
        </button>
      ) : (
        <div className="mt-3 rounded-2xl bg-red-50 p-4 text-sm text-red-950">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-bold">Cleared for good</p>
              <ul className="mt-1 list-disc pl-5">
                <li>Campaigns</li>
                <li>Content, ads and fund requests</li>
                <li>Reports, including overdue ones</li>
                <li>Numbers, budget and spend</li>
                <li>Notes and the activity feed</li>
                <li>Media plan, strategy and Canva link</li>
              </ul>
            </div>
            <div>
              <p className="font-bold">Kept</p>
              <ul className="mt-1 list-disc pl-5">
                <li>Name, logo, banner and colours</li>
                <li>Brand profile</li>
                <li>Team, roles and Leave Mode</li>
                <li>Reporting rhythm and targets</li>
              </ul>
            </div>
          </div>
          <p className="mt-3">This can&apos;t be undone. New reports are scheduled from today.</p>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold">Type &quot;{brandName}&quot; to confirm</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} className="block min-h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-base" />
          </label>
          {message && !message.ok && <p role="alert" className="mt-2 font-medium">{message.message}</p>}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!matches || pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await startAfresh(brandId, typed);
                  setMessage(result);
                  if (result.ok) close();
                })
              }
              className="min-h-11 rounded-2xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              {pending ? "Clearing…" : "Clear and start afresh"}
            </button>
            <button type="button" onClick={close} className="min-h-11 px-3 text-sm font-semibold underline">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
