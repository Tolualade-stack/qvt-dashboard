"use client";

import { useActionState, useState } from "react";
import { addContent, updateContent } from "./actions";
import type { ContentItem } from "@/lib/content";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";

type Option = { id: string; label: string };

// Adding a content piece (collapsed until tapped), or editing one on its own page.
export function ContentForm({
  brandId,
  platforms,
  people,
  defaultNeedsApproval,
  item,
}: {
  brandId: string;
  platforms: Option[];
  people: Option[];
  defaultNeedsApproval: boolean;
  item?: ContentItem;
}) {
  const [open, setOpen] = useState(!!item);
  const action = item ? updateContent.bind(null, item.id, brandId) : addContent.bind(null, brandId);
  const [state, formAction, pending] = useActionState(action, null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-line text-sm font-bold text-muted hover:bg-mist"
      >
        + Add a content piece
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-[20px] bg-mist p-4">
      <Field label="Title">
        <input name="title" defaultValue={item?.title} placeholder="e.g. Suya spice recipe video" autoComplete="off" className={inputClass} />
      </Field>
      {platforms.length > 0 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Platforms</legend>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <label key={p.id} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-3.5 text-sm font-semibold has-checked:border-navy has-checked:bg-navy has-checked:text-white">
                <input type="checkbox" name="platforms" value={p.id} defaultChecked={item?.platforms.includes(p.id)} className="sr-only" />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner">
          <select name="owner_person_id" defaultValue={item?.owner_person_id ?? ""} className={inputClass}>
            <option value="">Not set</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Planned date">
          <input name="planned_date" type="date" defaultValue={item?.planned_date ?? ""} className={inputClass} />
        </Field>
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="needs_approval" defaultChecked={item?.needs_approval ?? defaultNeedsApproval} className="mt-0.5 size-5 accent-navy" />
        <span>
          <span className="block font-semibold">Needs approval</span>
          <span className="block text-xs text-muted">A real stakeholder or influencer is involved, so it goes for approval before scheduling.</span>
        </span>
      </label>
      {item && (
        <Field label="Post link">
          <input name="post_url" type="url" defaultValue={item.post_url ?? ""} placeholder="https://…" className={inputClass} />
        </Field>
      )}
      <Field label="Notes (optional)">
        <textarea name="notes" defaultValue={item?.notes ?? ""} rows={2} className={`${inputClass} py-3`} />
      </Field>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : item ? "Save changes" : "Add content"}</Button>
        {!item && <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Close</Button>}
      </div>
    </form>
  );
}
