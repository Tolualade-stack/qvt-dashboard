import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { loadWorld, platformLabel } from "@/lib/world";
import { mediaUrl } from "@/lib/media";
import { lagosMonth, type ContentItem } from "@/lib/content";
import { ContentCard } from "../content/content-card";
import { ContentForm } from "../content/content-form";

export const metadata: Metadata = { title: "Update · PRIME" };

// The Update screen for one world: add content pieces and move them on with one
// tap. Notes ("What changed?") and numbers join this screen in the next steps.
export default async function UpdatePage({ params }: PageProps<"/brands/[id]/update">) {
  const { id } = await params;
  const { brand, theme, platforms, people, canEdit, supabase } = await loadWorld(id);

  const { data: rows } = await supabase
    .from("content_items")
    .select("*")
    .eq("brand_id", id)
    .eq("is_archived", false)
    .order("planned_date", { ascending: true, nullsFirst: false })
    .order("created_at");
  const items = (rows ?? []) as ContentItem[];
  const month = lagosMonth();
  const active = items.filter((i) => i.status !== "posted");
  const posted = items.filter((i) => i.status === "posted" && i.posted_at && i.posted_at >= month.startIso);
  const nameOf = new Map(people.map((p) => [p.id, p.label]));
  const logo = mediaUrl(brand.logo_path);

  return (
    <div className="space-y-5">
      <header
        className="-mx-5 -mt-4 flex items-center gap-3 px-5 pt-5 pb-6 sm:mx-0 sm:mt-0 sm:rounded-[26px]"
        style={{ background: `linear-gradient(150deg, ${theme.main} 0%, ${theme.deep} 100%)`, color: theme.onMain }}
      >
        <Link href={`/brands/${id}`} aria-label={`Back to ${brand.name}`} className="flex size-[42px] shrink-0 items-center justify-center rounded-[14px] bg-black/30 text-white">
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m15 6-6 6 6 6" /></svg>
        </Link>
        <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white font-display text-xl font-black" style={{ color: theme.ink }}>
          {logo ? <Image src={logo} alt="" fill sizes="48px" className="object-contain p-1" /> : brand.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="text-xs font-bold tracking-[0.2em] opacity-85">UPDATE</div>
          <h1 className="truncate font-display text-[28px] leading-none font-black">{brand.name}</h1>
        </div>
      </header>

      <nav aria-label="Update type" className="grid grid-cols-3 gap-1 rounded-2xl bg-mist p-1">
        <span aria-current="page" className="flex min-h-10 items-center justify-center rounded-xl bg-white text-sm font-bold shadow-sm">Content</span>
        <span className="flex min-h-10 flex-col items-center justify-center rounded-xl text-sm font-semibold text-muted">
          Note <span className="text-[10px] font-medium">next</span>
        </span>
        <span className="flex min-h-10 flex-col items-center justify-center rounded-xl text-sm font-semibold text-muted">
          Numbers <span className="text-[10px] font-medium">Phase 3</span>
        </span>
      </nav>

      {canEdit ? (
        <ContentForm brandId={id} platforms={platforms} people={people} defaultNeedsApproval={brand.tier === "heavy"} />
      ) : (
        <p className="rounded-2xl bg-mist p-4 text-sm text-muted">You can view this world&apos;s content, but not change it.</p>
      )}

      <section>
        <h2 className="mb-2 font-display text-xl font-black">In progress <span className="text-base text-muted">· {active.length}</span></h2>
        {active.length === 0 && <p className="text-sm text-muted">Nothing in progress. Add the pieces from this month&apos;s Canva calendar.</p>}
        <div className="space-y-3">
          {active.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              theme={theme}
              ownerName={item.owner_person_id ? (nameOf.get(item.owner_person_id) ?? null) : null}
              platformLabels={platformLabel(platforms, item.platforms)}
              canEdit={canEdit}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-display text-xl font-black">Posted in {month.label} <span className="text-base text-muted">· {posted.length}</span></h2>
        {posted.length === 0 && <p className="text-sm text-muted">Nothing posted yet this month.</p>}
        <div className="space-y-3">
          {posted.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              theme={theme}
              ownerName={item.owner_person_id ? (nameOf.get(item.owner_person_id) ?? null) : null}
              platformLabels={platformLabel(platforms, item.platforms)}
              canEdit={canEdit}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
