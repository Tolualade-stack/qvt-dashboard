"use client";

import { useState, useTransition } from "react";
import { RemoveButton } from "@/components/remove-button";
import { removeWork } from "../../remove-actions";
import { fixDeliverable } from "../actions";

// Correct how many are planned or done for one counted item, or remove it.
export function DeliverableEdit({ id, brandId, planned, done, unit }: { id: string; brandId: string; planned: number | null; done: number; unit: string }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState(planned == null ? "" : String(planned));
  const [count, setCount] = useState(String(done));
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1 min-h-10 text-xs font-semibold underline">
        Change or remove
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-2xl bg-white p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold">
          Planned
          <input inputMode="numeric" value={plan} onChange={(e) => setPlan(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-line px-3 text-base" />
        </label>
        <label className="block text-xs font-semibold">
          {unit[0].toUpperCase() + unit.slice(1)} so far
          <input inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className="mt-1 block min-h-11 w-full rounded-xl border border-line px-3 text-base" />
        </label>
      </div>
      {message && <p role="status" className={`text-xs font-medium ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.message}</p>}
      <div className="flex flex-wrap items-start gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => setMessage(await fixDeliverable(id, brandId, plan, count)))}
          className="min-h-11 rounded-full bg-ink px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <RemoveButton action={removeWork.bind(null, "deliverable", id, brandId)} />
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-2 text-sm font-semibold text-muted underline">Close</button>
      </div>
    </div>
  );
}
