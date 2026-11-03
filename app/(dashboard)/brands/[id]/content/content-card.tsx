"use client";

import Link from "next/link";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { advanceContent, savePostLink, sendBackContent } from "./actions";
import { STATUS_LABELS, nextStatus, statusTone, type ContentItem, type ContentStatus } from "@/lib/content";
import type { FormState } from "@/lib/form-state";
import { FormMessage, inputClass } from "@/components/ui";

type Theme = { main: string; deep: string; ink: string; soft: string; onMain: string };

// One content piece on the Update screen. The big button moves it on with one
// tap; the new stage shows at once while the save happens in the background.
export function ContentCard({
  item,
  theme,
  ownerName,
  platformLabels,
  canEdit,
}: {
  item: ContentItem;
  theme: Theme;
  ownerName: string | null;
  platformLabels: string;
  canEdit: boolean;
}) {
  const [status, setOptimisticStatus] = useOptimistic<ContentStatus>(item.status);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<FormState>(null);
  const [linkState, linkAction, linkPending] = useActionState(savePostLink.bind(null, item.id, item.brand_id), null);

  const next = nextStatus(status, item.needs_approval);
  const tone = statusTone(status);

  function move(to: ContentStatus, run: () => Promise<FormState>) {
    setMessage(null);
    startTransition(async () => {
      setOptimisticStatus(to);
      const result = await run();
      if (result && !result.ok) setMessage(result);
    });
  }

  return (
    <article className="overflow-hidden rounded-[20px] border border-line bg-white">
      <div className="flex">
        <span aria-hidden="true" className="w-1.5 shrink-0" style={{ backgroundColor: theme.main }} />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/brands/${item.brand_id}/content/${item.id}`} className="min-w-0">
              <span className="block text-[15px] leading-snug font-semibold">{item.title}</span>
              <span className="block text-xs text-muted">
                {[platformLabels, ownerName, item.planned_date && `Planned ${formatShortDate(item.planned_date)}`].filter(Boolean).join(" · ")}
              </span>
            </Link>
            <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap" style={{ backgroundColor: tone.bg, color: tone.fg }}>
              {STATUS_LABELS[status]}
            </span>
          </div>

          {item.revision_round > 0 && (
            <div className="text-xs font-semibold text-[#7A4B00]">Revision round {item.revision_round} of 4</div>
          )}

          {canEdit && next && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => move(next, () => advanceContent(item.id, item.brand_id))}
                className="min-h-12 flex-1 rounded-[14px] text-sm font-bold transition active:scale-[0.98] disabled:opacity-70"
                style={{ background: `linear-gradient(135deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}
              >
                Mark as {STATUS_LABELS[next]}
              </button>
              {status === "awaiting_approval" && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => move("asset_in_progress", () => sendBackContent(item.id, item.brand_id))}
                  className="min-h-12 rounded-[14px] border border-line bg-white px-4 text-sm font-semibold"
                >
                  Send back
                </button>
              )}
            </div>
          )}

          {status === "posted" &&
            (item.post_url ? (
              <a href={item.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center text-sm font-bold underline" style={{ color: theme.ink }}>
                View the post
              </a>
            ) : (
              canEdit && (
                <form action={linkAction} className="flex gap-2">
                  <input name="post_url" type="url" placeholder="Paste the post link" aria-label="Post link" className={`${inputClass} min-h-11`} />
                  <button type="submit" disabled={linkPending} className="min-h-11 shrink-0 rounded-2xl border border-line px-4 text-sm font-semibold">
                    Save
                  </button>
                </form>
              )
            ))}
          <FormMessage state={message ?? linkState} />
        </div>
      </div>
    </article>
  );
}

function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
}
