"use client";

import { useActionState } from "react";
import { addNote } from "./actions";
import { SOURCE_LABELS, type NoteSource } from "@/lib/notes";
import { Field, FormMessage, inputClass } from "@/components/ui";

type Theme = { main: string; deep: string; onMain: string };

// The quick "What changed?" form: an optional linked content piece, where it
// came from, and a short note. The form clears itself after saving.
export function NoteForm({ brandId, items, theme }: { brandId: string; items: { id: string; title: string }[]; theme: Theme }) {
  const [state, formAction, pending] = useActionState(addNote.bind(null, brandId), null);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="What changed?">
        <textarea
          name="note"
          rows={4}
          placeholder="e.g. Client approved the 15 s cut on a call"
          className={`${inputClass} py-3`}
        />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Where did it come from? (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SOURCE_LABELS) as NoteSource[]).map((source) => (
            <label
              key={source}
              className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-line bg-white px-3.5 text-sm font-semibold has-checked:border-navy has-checked:bg-navy has-checked:text-white"
            >
              <input type="radio" name="source" value={source} className="sr-only" />
              {SOURCE_LABELS[source]}
            </label>
          ))}
        </div>
      </fieldset>

      {items.length > 0 && (
        <Field label="About a content piece? (optional)">
          <select name="content_item_id" defaultValue="" className={inputClass}>
            <option value="">No, a general update</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </Field>
      )}

      <FormMessage state={state} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-[52px] w-full rounded-2xl text-base font-bold transition active:scale-[0.99] disabled:opacity-70"
        style={{ background: `linear-gradient(135deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}
      >
        {pending ? "Saving…" : "Save update"}
      </button>
    </form>
  );
}
