"use client";

import { useActionState, useState } from "react";
import { addNumbers } from "./actions";
import { METRIC_FIELDS } from "@/lib/metrics";
import { Field, FormMessage, inputClass } from "@/components/ui";

type Theme = { main: string; deep: string; ink: string; soft: string; onMain: string };

// Upload one channel's numbers for a period. TV and Radio ask for spots aired;
// digital channels ask for the six headline numbers. Leave a box empty if the
// platform doesn't report it.
export function NumbersForm({
  brandId,
  channels,
  theme,
  defaultStart,
  defaultEnd,
}: {
  brandId: string;
  channels: { id: string; label: string }[];
  theme: Theme;
  defaultStart: string;
  defaultEnd: string;
}) {
  const [channel, setChannel] = useState(channels[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(addNumbers.bind(null, brandId), null);
  const traditional = channel === "tv" || channel === "radio";

  if (channels.length === 0) {
    return <p className="rounded-2xl bg-mist p-4 text-sm text-muted">This world has no channels yet. Add them with Edit world.</p>;
  }

  return (
    <form action={formAction} className="space-y-4 rounded-[20px] bg-mist p-4">
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Channel</legend>
        <div className="flex flex-wrap gap-2">
          {channels.map((c) => (
            <label
              key={c.id}
              className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-line bg-white px-3.5 text-sm font-semibold has-checked:border-transparent"
              style={channel === c.id ? { backgroundColor: theme.main, color: theme.onMain } : undefined}
            >
              <input type="radio" name="channel" value={c.id} checked={channel === c.id} onChange={() => setChannel(c.id)} className="sr-only" />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <input name="period_start" type="date" defaultValue={defaultStart} className={inputClass} />
        </Field>
        <Field label="To">
          <input name="period_end" type="date" defaultValue={defaultEnd} className={inputClass} />
        </Field>
      </div>

      {traditional ? (
        <Field label="Spots aired in this period">
          <input name="spots_aired" inputMode="numeric" className={inputClass} />
        </Field>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {METRIC_FIELDS.map(([field, label]) => (
            <Field key={field} label={label}>
              <input name={field} inputMode="numeric" className={inputClass} />
            </Field>
          ))}
        </div>
      )}

      <p className="text-xs text-muted">Leave a box empty if the platform doesn&apos;t report it. Later these fill in by themselves from the Google Sheet and the ad accounts.</p>
      <FormMessage state={state} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-[52px] w-full rounded-2xl text-base font-bold disabled:opacity-70"
        style={{ background: `linear-gradient(135deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}
      >
        {pending ? "Saving…" : "Save numbers"}
      </button>
    </form>
  );
}
