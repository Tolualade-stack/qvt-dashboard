"use client";

import { useActionState, useOptimistic, useState, useTransition } from "react";
import { addAsset, addReport, advanceAsset, markReportSent, saveReportLink } from "./actions";
import { removeReport, removeWork } from "../remove-actions";
import { RemoveButton } from "@/components/remove-button";
import {
  ASSET_STATUS_LABELS,
  ASSET_TYPES,
  NEXT_ASSET_STATUS,
  REPORT_KIND_LABELS,
  REPORT_TONES,
  dueDay,
  lateBy,
  reportState,
  type AssetStatus,
  type CreativeAsset,
  type Report,
} from "@/lib/reports";
import { formatDateTime } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";

type Theme = { main: string; deep: string; ink: string; soft: string; onMain: string };

const mainButton = (theme: Theme) => ({ background: `linear-gradient(135deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain });

// One client report: when it's due, and a one-tap "Mark as sent".
export function ReportCard({ report, theme, canEdit }: { report: Report; theme: Theme; canEdit: boolean }) {
  const [sent, setOptimisticSent] = useOptimistic(!!report.sent_at);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<FormState>(null);
  const [linkState, linkAction, linkPending] = useActionState(saveReportLink.bind(null, report.id, report.brand_id), null);

  const state = sent ? "sent" : reportState(report);
  const tone = REPORT_TONES[state];
  const statusText =
    state === "sent"
      ? `Sent ${report.sent_at ? formatDateTime(report.sent_at) : "just now"}`
      : state === "overdue"
        ? `Overdue by ${lateBy(report.due_at)}`
        : `Due ${dueDay(report.due_at)}`;

  const toggle = (to: boolean) => {
    setMessage(null);
    startTransition(async () => {
      setOptimisticSent(to);
      const result = await markReportSent(report.id, report.brand_id, to);
      if (!result?.ok) setMessage(result);
    });
  };

  return (
    <article className="rounded-[20px] border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[15px] font-semibold">{REPORT_KIND_LABELS[report.kind]}</div>
          <div className="text-xs text-muted">{report.period_label} · due {dueDay(report.due_at)}</div>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: tone.bg, color: tone.fg }}>{statusText}</span>
      </div>
      {canEdit && !sent && (
        <button type="button" disabled={pending} onClick={() => toggle(true)} className="mt-3 min-h-12 w-full rounded-[14px] text-sm font-bold disabled:opacity-70" style={mainButton(theme)}>
          Mark as sent
        </button>
      )}
      {sent &&
        (report.link ? (
          <a href={report.link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-9 items-center text-sm font-bold underline" style={{ color: theme.ink }}>
            Open the report
          </a>
        ) : (
          canEdit && (
            <form action={linkAction} className="mt-3 flex gap-2">
              <input name="link" type="url" placeholder="Paste the report link (optional)" aria-label="Report link" className={`${inputClass} min-h-11`} />
              <button type="submit" disabled={linkPending} className="min-h-11 shrink-0 rounded-2xl border border-line px-4 text-sm font-semibold">Save</button>
            </form>
          )
        ))}
      {canEdit && sent && (
        <button type="button" disabled={pending} onClick={() => toggle(false)} className="mt-2 min-h-8 text-xs font-semibold text-muted underline">
          Not sent yet? Undo
        </button>
      )}
      {canEdit && report.kind === "other" && (
        <div className="mt-2"><RemoveButton action={removeReport.bind(null, report.id, report.brand_id)} /></div>
      )}
      <FormMessage state={message ?? linkState} />
    </article>
  );
}

export function AddReportForm({ brandId }: { brandId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addReport.bind(null, brandId), null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-10 text-sm font-bold text-muted underline">
        + Add another report (e.g. for a partnership)
      </button>
    );
  }
  return (
    <form action={formAction} className="space-y-3 rounded-[20px] bg-mist p-4">
      <Field label="What it's for">
        <input name="period_label" placeholder="e.g. Race-day partnership recap" className={inputClass} />
      </Field>
      <Field label="Due date">
        <input name="due_date" type="date" className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add report"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </form>
  );
}

// One creative asset, moved on with one tap: In production -> Ready -> Deployed.
export function AssetCard({ asset, theme, ownerName, canEdit }: { asset: CreativeAsset; theme: Theme; ownerName: string | null; canEdit: boolean }) {
  const [status, setOptimisticStatus] = useOptimistic<AssetStatus>(asset.status);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<FormState>(null);
  const next = NEXT_ASSET_STATUS[status];
  const tone = status === "deployed" ? REPORT_TONES.sent : status === "ready" ? { bg: "#E4ECFB", fg: "#1F4A9E" } : REPORT_TONES.due_soon;

  return (
    <article className="overflow-hidden rounded-[20px] border border-line bg-white">
      <div className="flex">
        <span aria-hidden="true" className="w-1.5 shrink-0" style={{ backgroundColor: theme.main }} />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">{asset.title}</div>
              <div className="text-xs text-muted">{[asset.asset_type, ownerName].filter(Boolean).join(" · ")}</div>
            </div>
            <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: tone.bg, color: tone.fg }}>{ASSET_STATUS_LABELS[status]}</span>
          </div>
          {asset.link && (
            <a href={asset.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center text-sm font-bold underline" style={{ color: theme.ink }}>
              Open the file
            </a>
          )}
          {canEdit && next && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setMessage(null);
                  setOptimisticStatus(next);
                  const result = await advanceAsset(asset.id, asset.brand_id);
                  if (!result?.ok) setMessage(result);
                })
              }
              className="min-h-12 rounded-[14px] text-sm font-bold disabled:opacity-70"
              style={mainButton(theme)}
            >
              Mark as {ASSET_STATUS_LABELS[next]}
            </button>
          )}
          {canEdit && <div><RemoveButton action={removeWork.bind(null, "asset", asset.id, asset.brand_id)} /></div>}
          <FormMessage state={message} />
        </div>
      </div>
    </article>
  );
}

export function AddAssetForm({ brandId, people }: { brandId: string; people: { id: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addAsset.bind(null, brandId), null);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center justify-center rounded-[20px] border-2 border-dashed border-line text-sm font-bold text-muted hover:bg-mist"
      >
        + Add a creative asset
      </button>
    );
  }
  return (
    <form action={formAction} className="space-y-3 rounded-[20px] bg-mist p-4">
      <Field label="Asset name">
        <input name="title" placeholder="e.g. Curry jollof key visual" autoComplete="off" className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select name="asset_type" defaultValue="" className={inputClass}>
            <option value="">Not set</option>
            {ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Owner">
          <select name="owner_person_id" defaultValue="" className={inputClass}>
            <option value="">Not set</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Link to the file (optional)" hint="e.g. the Canva design, so anyone can check progress.">
        <input name="link" type="url" placeholder="https://www.canva.com/…" className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add asset"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </form>
  );
}
