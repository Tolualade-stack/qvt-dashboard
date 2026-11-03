import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Brand } from "@/lib/types";
import type { UpdateNote } from "@/lib/notes";
import { NoteList } from "@/components/note-list";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Update log · PRIME" };

// Every "What changed?" note across all worlds, newest first. Tap a brand to
// see only its updates.
export default async function LogPage({ searchParams }: PageProps<"/log">) {
  const brandFilter = (await searchParams).brand;
  const selected = typeof brandFilter === "string" ? brandFilter : null;
  const supabase = await createClient();

  let notesQuery = supabase.from("update_notes").select("*").order("created_at", { ascending: false }).limit(60);
  if (selected) notesQuery = notesQuery.eq("brand_id", selected);

  const [{ data: brandRows }, { data: noteRows }] = await Promise.all([
    supabase.from("brands").select("id, name, colour").eq("is_archived", false).order("sort_order"),
    notesQuery,
  ]);
  const brands = (brandRows ?? []) as Pick<Brand, "id" | "name" | "colour">[];
  const notes = (noteRows ?? []) as UpdateNote[];

  const itemIds = [...new Set(notes.map((n) => n.content_item_id).filter((x): x is string => !!x))];
  const { data: itemRows } = itemIds.length
    ? await supabase.from("content_items").select("id, title").in("id", itemIds)
    : { data: [] };

  const chip = (active: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ${active ? "bg-navy text-white" : "bg-mist text-ink"}`;

  return (
    <>
      <PageTitle subtitle="Everything that happened on calls, WhatsApp and in person, in one place.">Update log</PageTitle>
      <nav aria-label="Filter by brand" className="-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
        <Link href="/log" aria-current={!selected ? "page" : undefined} className={chip(!selected)}>All</Link>
        {brands.map((b) => (
          <Link key={b.id} href={`/log?brand=${b.id}`} aria-current={selected === b.id ? "page" : undefined} className={chip(selected === b.id)}>
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: b.colour }} />
            {b.name}
          </Link>
        ))}
      </nav>
      <NoteList
        notes={notes}
        brandOf={selected ? undefined : new Map(brands.map((b) => [b.id, { name: b.name, colour: b.colour }]))}
        itemTitleOf={new Map((itemRows ?? []).map((i) => [i.id, i.title]))}
      />
      {selected && (
        <Link href={`/brands/${selected}/update?tab=note`} className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-navy">
          + Add an update to this world
        </Link>
      )}
    </>
  );
}
