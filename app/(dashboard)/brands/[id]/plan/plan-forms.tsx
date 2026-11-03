"use client";

import { useActionState, useState } from "react";
import { addBudgetLine, importBudgetLines, savePlanDocuments } from "./actions";
import { createClient } from "@/lib/supabase/browser";
import { fail, type FormState } from "@/lib/form-state";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";

const DOC_TYPES = ".pdf,.xlsx,.xls,.csv,.pptx,.docx";

// Media plan and strategy: a live link (Google Sheets, Canva, Drive…) and/or a
// file. Files go straight from the browser to private storage.
export function PlanDocumentsForm({
  brandId,
  mediaPlanUrl,
  strategyUrl,
  mediaPlanPath,
  strategyPath,
}: {
  brandId: string;
  mediaPlanUrl: string | null;
  strategyUrl: string | null;
  mediaPlanPath: string | null;
  strategyPath: string | null;
}) {
  const [files, setFiles] = useState<{ media_plan?: File; strategy?: File }>({});
  const [state, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const supabase = createClient();
    for (const kind of ["media_plan", "strategy"] as const) {
      const file = files[kind];
      if (!file) continue;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
      const path = `${brandId}/${kind}-${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("brand-documents").upload(path, file, { contentType: file.type || undefined });
      if (error) return fail(`Couldn't upload the ${kind === "media_plan" ? "media plan" : "strategy"}: ${error.message}`);
      formData.set(`${kind}_path`, path);
    }
    return savePlanDocuments(brandId, prev, formData);
  }, null);

  const doc = (kind: "media_plan" | "strategy", label: string, link: string | null, path: string | null) => (
    <fieldset className="space-y-2 rounded-2xl border border-line bg-white p-4">
      <legend className="px-1 text-sm font-bold">{label}</legend>
      <input type="hidden" name={`${kind}_path`} value={path ?? ""} />
      <Field label="Live link (optional)" hint="Google Sheets, Canva, Drive or similar. Keep it shared with your team.">
        <input name={`${kind}_url`} type="url" defaultValue={link ?? ""} placeholder="https://…" className={inputClass} />
      </Field>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">File (optional)</span>
        <input
          type="file"
          accept={DOC_TYPES}
          onChange={(e) => setFiles({ ...files, [kind]: e.target.files?.[0] })}
          className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-full file:border-0 file:bg-mist file:px-4 file:font-semibold"
        />
        <span className="mt-1 block text-xs text-muted">
          {files[kind] ? `Ready to upload: ${files[kind]!.name}` : path ? "A file is already uploaded. Choose another to replace it." : "PDF, Excel, CSV, PowerPoint or Word, up to 20 MB."}
        </span>
      </label>
    </fieldset>
  );

  return (
    <form action={formAction} className="space-y-3">
      {doc("media_plan", "Media plan", mediaPlanUrl, mediaPlanPath)}
      {doc("strategy", "Strategy", strategyUrl, strategyPath)}
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save plan and strategy"}</Button>
    </form>
  );
}

export function BudgetLineForm({ brandId, channels }: { brandId: string; channels: { id: string; label: string; formats: readonly string[] }[] }) {
  const [channel, setChannel] = useState(channels[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(addBudgetLine.bind(null, brandId), null);
  const formats = channels.find((c) => c.id === channel)?.formats ?? [];
  return (
    <form action={formAction} className="space-y-3 rounded-[20px] bg-mist p-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Channel">
          <select name="channel" value={channel} onChange={(e) => setChannel(e.target.value)} className={inputClass}>
            {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Format (optional)">
          <select name="format" key={channel} defaultValue="" className={inputClass}>
            <option value="">Whole channel</option>
            {formats.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-[5rem_1fr] gap-3">
        <Field label="Currency">
          <select name="currency" defaultValue="NGN" className={inputClass}>
            <option value="NGN">₦</option>
            <option value="USD">$</option>
          </select>
        </Field>
        <Field label="Planned amount">
          <input name="planned_amount" inputMode="decimal" placeholder="e.g. 300000" className={inputClass} />
        </Field>
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add budget line"}</Button>
    </form>
  );
}

export function ImportLinesForm({ brandId }: { brandId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(importBudgetLines.bind(null, brandId), null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-10 text-sm font-bold text-muted underline">
        Paste rows from your media plan spreadsheet
      </button>
    );
  }
  return (
    <form action={formAction} className="space-y-3 rounded-[20px] bg-mist p-4">
      <Field
        label="Rows from the plan"
        hint="Copy the rows in Excel or Google Sheets and paste here. Columns: Channel, Format, Amount, Currency. Format and Currency are optional."
      >
        <textarea name="rows" rows={6} placeholder={"TikTok\tSpark Ads\t300000\tNGN\nYouTube\tBumper (6 s)\t500\tUSD\nInstagram\t\t250000"} className={`${inputClass} py-3 font-mono text-sm`} />
      </Field>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Importing…" : "Add these lines"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </form>
  );
}
