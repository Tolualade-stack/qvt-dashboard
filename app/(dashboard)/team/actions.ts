"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, type FormState } from "@/lib/form-state";
import { ROLE_KEY_LABELS, type RoleKey } from "@/lib/types";

// Team management: people, their jobs on each brand, and the role catalogue.
// Admin only. Everything goes through the Admin's own session, so the history
// records who made each change.

function refresh() {
  revalidatePath("/", "layout");
}

// The workspace new people and roles belong to (one during the pilot).
async function currentWorkspaceId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("workspaces").select("id").order("sort_order").limit(1).single();
  return data?.id as string;
}

const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function addPerson(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return fail("Enter the person's name.");

  const supabase = await createClient();
  const workspaceId = await currentWorkspaceId(supabase);
  // Add a short random ending if someone with the same name already exists.
  let slug = slugify(name) || "person";
  const { count } = await supabase.from("people").select("id", { count: "exact", head: true }).eq("slug", slug);
  if (count) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const { error } = await supabase.from("people").insert({ full_name: name, slug, workspace_id: workspaceId });
  if (error) return fail(error.message);
  refresh();
  return ok(`${name} added. Now assign them to a brand.`);
}

export async function setPersonActive(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({ is_active: formData.get("active") === "true" })
    .eq("id", String(formData.get("personId")));
  if (error) throw new Error(error.message);
  refresh();
}

// Puts a person on a brand in a role from the catalogue. Optional "focus" adds
// detail to the label, e.g. Channel Manager (TikTok).
export async function assignRole(personId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const brandId = String(formData.get("brandId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  const focus = String(formData.get("focus") ?? "").trim();
  const responsibilities = String(formData.get("responsibilities") ?? "").trim();
  if (!brandId || !roleId) return fail("Choose a brand and a role.");

  const supabase = await createClient();
  const { data: role } = await supabase.from("role_catalogue").select("name, role_key, description").eq("id", roleId).single();
  if (!role) return fail("That role no longer exists.");

  const { data: last } = await supabase
    .from("brand_roles")
    .select("sort_order")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("brand_roles").insert({
    brand_id: brandId,
    person_id: personId,
    role_id: roleId,
    role_key: role.role_key,
    title: focus ? `${role.name} (${focus})` : role.name,
    responsibilities: responsibilities || role.description,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return fail(error.message);
  refresh();
  return ok("Assigned.");
}

// Moves someone off a brand. The row stays, with an end date, as history.
export async function endAssignment(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("brand_roles")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", String(formData.get("assignmentId")));
  if (error) throw new Error(error.message);
  refresh();
}

export async function addRole(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const roleKey = String(formData.get("roleKey") ?? "other") as RoleKey;
  if (name.length < 2) return fail("Give the role a name.");
  if (!(roleKey in ROLE_KEY_LABELS)) return fail("Choose what kind of role it is.");

  const supabase = await createClient();
  const workspaceId = await currentWorkspaceId(supabase);
  const { count } = await supabase.from("role_catalogue").select("id", { count: "exact", head: true });
  const { error } = await supabase.from("role_catalogue").insert({
    workspace_id: workspaceId,
    name,
    description: description || null,
    role_key: roleKey,
    sort_order: (count ?? 0) + 1,
  });
  if (error) return fail(error.code === "23505" ? "That role is already in the catalogue." : error.message);
  refresh();
  return ok(`"${name}" added to the role catalogue.`);
}

export async function setRoleActive(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("role_catalogue")
    .update({ is_active: formData.get("active") === "true" })
    .eq("id", String(formData.get("roleId")));
  if (error) throw new Error(error.message);
  refresh();
}
