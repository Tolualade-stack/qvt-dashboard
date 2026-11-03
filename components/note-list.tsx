import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import { SOURCE_LABELS, type UpdateNote } from "@/lib/notes";

// A list of "What changed?" notes, newest first. Optionally shows which world
// each belongs to (on the all-brands log) and the content piece it is about.
export function NoteList({
  notes,
  brandOf,
  itemTitleOf,
}: {
  notes: UpdateNote[];
  brandOf?: Map<string, { name: string; colour: string }>;
  itemTitleOf?: Map<string, string>;
}) {
  if (notes.length === 0) return <p className="text-sm text-muted">No updates logged yet.</p>;
  return (
    <ul className="divide-y divide-line">
      {notes.map((n) => {
        const brand = brandOf?.get(n.brand_id);
        const itemTitle = n.content_item_id ? itemTitleOf?.get(n.content_item_id) : undefined;
        return (
          <li key={n.id} className="py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span className="font-bold text-ink">{n.author_name}</span>
              {brand && (
                <span className="inline-flex items-center gap-1">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: brand.colour }} />
                  {brand.name}
                </span>
              )}
              {n.source && <span className="rounded-full bg-mist px-2 py-0.5 font-semibold">{SOURCE_LABELS[n.source]}</span>}
              <span>{formatDateTime(n.created_at)}</span>
            </div>
            <p className="mt-1 text-[15px] leading-snug whitespace-pre-line">{n.note}</p>
            {itemTitle && (
              <Link href={`/brands/${n.brand_id}/content/${n.content_item_id}`} className="mt-1 inline-flex min-h-8 items-center text-xs font-semibold text-muted underline">
                About: {itemTitle}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
