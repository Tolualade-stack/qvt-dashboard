import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/media";
import type { Brand } from "@/lib/types";
import { WorldForm } from "@/app/(dashboard)/worlds/world-form";

export const metadata: Metadata = { title: "Edit world · PRIME" };

// The same four steps as "Create a dashboard", filled in with this brand's details.
export default async function EditWorldPage({ params }: PageProps<"/brands/[id]/edit">) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: brandRow }, { data: people }, { data: roles }] = await Promise.all([
    supabase.from("brands").select("*").eq("id", id).maybeSingle(),
    supabase.from("people").select("id, full_name").eq("is_active", true).eq("is_placeholder", false).order("full_name"),
    supabase.from("brand_roles").select("role_catalogue(name)").eq("brand_id", id).is("ended_at", null),
  ]);
  if (!brandRow) notFound();
  const brand = brandRow as Brand;

  const assignedRoles = (roles ?? [])
    .map((r) => (r.role_catalogue as unknown as { name: string } | null)?.name)
    .filter((n): n is string => !!n);

  return (
    <WorldForm
      brand={brand}
      bannerUrl={mediaUrl(brand.banner_path)}
      logoUrl={mediaUrl(brand.logo_path)}
      people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name }))}
      assignedRoles={assignedRoles}
    />
  );
}
