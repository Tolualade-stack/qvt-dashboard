"use client";

import { useState, useTransition } from "react";
import { deleteBrand } from "../brands/[id]/remove-actions";

// Deleting a world is permanent, so it opens a box that asks for the brand's
// name before the button works.
export function DeleteWorldForm({ brandId, brandName }: { brandId: string; brandName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const matches = typed.trim().toLowerCase() === brandName.trim().toLowerCase();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-10 rounded-2xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700">
        Delete
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-2xl bg-red-50 p-3 text-sm text-red-950">
      <p>
        <b>This deletes {brandName} for good:</b> its campaigns, content, ads, reports, numbers, notes and images. It can&apos;t be undone. To keep the data, use Archive instead.
      </p>
      <label className="mt-2 block">
        <span className="mb-1 block text-xs font-semibold">Type &quot;{brandName}&quot; to confirm</span>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} className="block min-h-11 w-full rounded-xl border border-red-200 bg-white px-3 text-base" />
      </label>
      {message && <p role="alert" className="mt-2 font-medium">{message.message}</p>}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!matches || pending}
          onClick={() => startTransition(async () => setMessage(await deleteBrand(brandId, typed)))}
          className="min-h-11 rounded-2xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Delete for good"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setTyped(""); setMessage(null); }} className="min-h-11 px-3 text-sm font-semibold underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
