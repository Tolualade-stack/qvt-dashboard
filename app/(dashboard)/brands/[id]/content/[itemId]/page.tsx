import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadWorld, platformLabel } from "@/lib/world";
import { formatDateTime } from "@/lib/format";
import { STATUS_LABELS, statusTone, type ContentItem } from "@/lib/content";
import type { AuditEntry } from "@/lib/types";
import { HistoryList } from "@/components/history-list";
import { NoteList } from "@/components/note-list";
import type { UpdateNote } from "@/lib/notes";
import { Card, SectionTitle } from "@/components/ui";
import { ContentForm } from "../content-form";

export const metadata: Metadata = { title: "Content piece · PRIME" };

// One content piece: where it stands, its full history, and (for editors) its details.
export default async function ContentItemPage({ params }: PageProps<"/brands/[id]/content/[itemId]">) {
  const { id, itemId } = await params;
  const { brand, theme, platforms, people, canEdit, supabase } = await loadWorld(id);

  const [{ data: row }, { data: historyRows }, { data: noteRows }] = await Promise.all([
    supabase.from("content_items").select("*").eq("id", itemId).eq("brand_id", id).maybeSingle(),
    supabase.from("audit_log").select("*").eq("table_name", "content_items").eq("row_id", itemId).order("changed_at", { ascending: false }),
    supabase.from("update_notes").select("*").eq("content_item_id", itemId).order("created_at", { ascending: false }),
  ]);
  if (!row) notFound();
  const item = row as ContentItem;
  const tone = statusTone(item.status);

  const facts = [
    ["Platforms", platformLabel(platforms, item.platforms) || "Not set"],
    ["Owner", people.find((p) => p.id === item.owner_person_id)?.label ?? "Not set"],
    ["Planned", item.planned_date ?? "Not set"],
    ["In this stage since", formatDateTime(item.status_changed_at)],
    ["Copy ready", item.copy_ready_at ? formatDateTime(item.copy_ready_at) : "Not yet"],
    ["Posted", item.posted_at ? formatDateTime(item.posted_at) : "Not yet"],
    ["Revision rounds", `${item.revision_round} of 4`],
    ["Approval", item.needs_approval ? "Needed (stakeholder involved)" : "Not needed"],
  ];

  return (
    <div className="space-y-4">
      <Link href={`/brands/${id}/update`} className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        {brand.name} · Update
      </Link>

      <div>
        <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: tone.bg, color: tone.fg }}>{STATUS_LABELS[item.status]}</span>
        <h1 className="mt-2 font-display text-3xl leading-tight font-black">{item.title}</h1>
        {item.post_url && (
          <a href={item.post_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-9 items-center text-sm font-bold underline" style={{ color: theme.ink }}>
            View the post
          </a>
        )}
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {item.notes && <p className="mt-3 border-t border-line pt-3 text-sm">{item.notes}</p>}
      </Card>

      <Card>
        <SectionTitle
          action={
            canEdit && (
              <Link href={`/brands/${id}/update?tab=note`} className="text-sm font-bold" style={{ color: theme.ink }}>
                + Add
              </Link>
            )
          }
        >
          Updates about this piece
        </SectionTitle>
        <NoteList notes={(noteRows ?? []) as UpdateNote[]} />
      </Card>

      <Card>
        <SectionTitle>History</SectionTitle>
        <HistoryList entries={(historyRows ?? []) as AuditEntry[]} />
      </Card>

      {canEdit && (
        <section>
          <h2 className="mb-2 font-display text-xl font-black">Edit details</h2>
          <ContentForm brandId={id} platforms={platforms} people={people} defaultNeedsApproval={item.needs_approval} item={item} />
        </section>
      )}
    </div>
  );
}
