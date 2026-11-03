"use client";

import { useActionState, useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import { importBudgetLines } from "./actions";
import { findBudgetLines, parseCsv, type FoundPlan } from "@/lib/plan-import";
import { Button, FormMessage } from "@/components/ui";

// Read budget lines straight from a media plan file. The file is read here in
// the browser; nothing is saved until the person ticks the lines and confirms.
export function FileImportForm({ brandId }: { brandId: string }) {
  const [plan, setPlan] = useState<FoundPlan>(null);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(importBudgetLines.bind(null, brandId), null);

  async function read(file: File | undefined) {
    setProblem(null);
    setPlan(null);
    if (!file) return;
    try {
      const sheets = /\.csv$/i.test(file.name)
        ? [{ sheet: file.name, data: parseCsv(await file.text()) }]
        : await readXlsxFile(file);
      const found = findBudgetLines(sheets);
      if (!found) {
        setProblem("Couldn't find budget lines in that file. It needs a column for the channel (e.g. Channel, Platform, Media) and one for money (e.g. Budget, Cost, Amount).");
        return;
      }
      setPlan(found);
      setPicked(found.lines.map(() => true));
    } catch {
      setProblem("Couldn't read that file. Use an Excel (.xlsx) or CSV file.");
    }
  }

  const chosen = plan ? plan.lines.filter((_, i) => picked[i]) : [];
  const rows = chosen.map((l) => [l.channel, l.format, l.amount, l.currency].join("\t")).join("\n");

  return (
    <div className="space-y-3 rounded-[20px] border-2 border-dashed border-line p-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Read budget lines from the media plan file</span>
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => read(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-full file:border-0 file:bg-mist file:px-4 file:font-semibold"
        />
        <span className="mt-1 block text-xs text-muted">Excel (.xlsx) or CSV. PRIME finds the channel, format and budget columns; you check them before anything is saved.</span>
      </label>

      {problem && <p className="rounded-2xl bg-amber-100 p-3 text-sm text-amber-950">{problem}</p>}

      {plan && (
        <form action={formAction} className="space-y-3">
          <p className="text-xs text-muted">
            Found on sheet &quot;{plan.sheet}&quot;: channel from &quot;{plan.columns.channel}&quot;
            {plan.columns.format ? `, format from "${plan.columns.format}"` : ""}, amount from &quot;{plan.columns.amount}&quot;. Untick anything that isn&apos;t a budget line.
          </p>
          <ul className="divide-y divide-line rounded-2xl bg-white">
            {plan.lines.map((line, i) => (
              <li key={i}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                  <input type="checkbox" checked={picked[i]} onChange={() => setPicked(picked.map((p, j) => (j === i ? !p : p)))} className="size-5 accent-navy" />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{line.channel}</span>
                    {line.format && <span className="text-muted"> · {line.format}</span>}
                  </span>
                  <span className="font-semibold whitespace-nowrap">
                    {line.currency === "USD" ? "$" : "₦"}
                    {Math.round(line.amount).toLocaleString("en-GB")}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <input type="hidden" name="rows" value={rows} />
          <FormMessage state={state} />
          <Button type="submit" disabled={pending || chosen.length === 0}>
            {pending ? "Adding…" : `Add ${chosen.length} budget ${chosen.length === 1 ? "line" : "lines"}`}
          </Button>
        </form>
      )}
    </div>
  );
}
