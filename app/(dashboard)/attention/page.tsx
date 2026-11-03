import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadFlags } from "@/lib/attention";
import type { Brand } from "@/lib/types";
import { FlagList } from "@/components/flag-list";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Needs attention · PRIME" };

// Everything overdue or close to it, across all worlds, most urgent first, with
// who to escalate each one to.
export default async function AttentionPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("brands").select("*").eq("is_archived", false).order("sort_order");
  const brands = (data ?? []) as Brand[];
  const flags = await loadFlags(supabase, brands);
  const total = [...flags.values()].reduce((n, f) => n + f.length, 0);

  return (
    <>
      <PageTitle subtitle="Overdue work and deadlines coming up, with who to escalate each one to.">Needs attention</PageTitle>
      {total === 0 && <p className="rounded-3xl bg-mist p-5 text-sm font-semibold">All clear. Nothing is late right now.</p>}
      <div className="space-y-6">
        {brands.map((brand) => {
          const list = flags.get(brand.id) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={brand.id}>
              <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-black">
                <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: brand.colour }} />
                {brand.name}
                <span className="text-base text-muted">· {list.length}</span>
              </h2>
              <FlagList flags={list} />
            </section>
          );
        })}
      </div>
    </>
  );
}
