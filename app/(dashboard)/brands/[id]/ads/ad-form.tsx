"use client";

import { useActionState, useState } from "react";
import { addAd, updateAd } from "./actions";
import type { Ad } from "@/lib/ads";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";

type Channel = { id: string; label: string; formats: readonly string[] };
type Option = { id: string; label: string };

// Adding an ad (collapsed until tapped), or editing one on its own page.
// The format list follows the chosen channel.
export function AdForm({ brandId, channels, people, ad }: { brandId: string; channels: Channel[]; people: Option[]; ad?: Ad }) {
  const [open, setOpen] = useState(!!ad);
  const [channel, setChannel] = useState(ad?.channel ?? channels[0]?.id ?? "");
  const action = ad ? updateAd.bind(null, ad.id, brandId) : addAd.bind(null, brandId);
  const [state, formAction, pending] = useActionState(action, null);
  const formats = channels.find((c) => c.id === channel)?.formats ?? [];

  if (channels.length === 0) {
    return <p className="rounded-2xl bg-mist p-4 text-sm text-muted">This world has no digital channels yet. Add them with Edit world.</p>;
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-line text-sm font-bold text-muted hover:bg-mist"
      >
        + Add an ad
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-[20px] bg-mist p-4">
      <Field label="Ad name">
        <input name="name" defaultValue={ad?.name} placeholder="e.g. Curry jollof reel, week 2" autoComplete="off" className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Channel">
          <select name="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Format">
          <select name="format" key={channel} defaultValue={ad?.channel === channel ? (ad?.format ?? "") : ""} className={inputClass}>
            <option value="">Not set</option>
            {formats.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <Field label="Currency">
          <select name="currency" defaultValue={ad?.currency ?? "NGN"} className={inputClass}>
            <option value="NGN">₦</option>
            <option value="USD">$</option>
          </select>
        </Field>
        <Field label="Budget (optional)">
          <input name="budget" inputMode="decimal" defaultValue={ad?.budget ?? ""} placeholder="e.g. 300000" className={inputClass} />
        </Field>
      </div>
      <Field label="Owner">
        <select name="owner_person_id" defaultValue={ad?.owner_person_id ?? ""} className={inputClass}>
          <option value="">Not set</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </Field>
      <Field label="Notes (optional)">
        <textarea name="notes" defaultValue={ad?.notes ?? ""} rows={2} className={`${inputClass} py-3`} />
      </Field>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : ad ? "Save changes" : "Add ad"}</Button>
        {!ad && <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Close</Button>}
      </div>
    </form>
  );
}
