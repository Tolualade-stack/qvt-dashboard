import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadMyWork } from "@/lib/work";
import { QuickUpdate } from "./quick-update";

export const metadata: Metadata = { title: "Update · PRIME" };

export default async function QuickUpdatePage() {
  const me = (await getCurrentUser())!;
  const supabase = await createClient();
  const { items, brands, elsewhere } = await loadMyWork(supabase, me);

  // Notes can go on brands this person has work on; the Admin can use any brand.
  const myBrandIds = new Set(items.map((i) => i.brandId));
  const noteBrands = brands.filter((b) => me.role === "admin" || me.role === "updates_manager" || myBrandIds.has(b.id)).map((b) => ({ id: b.id, name: b.name }));

  return <QuickUpdate items={items} brands={noteBrands} elsewhere={elsewhere} />;
}
