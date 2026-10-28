"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type FormState } from "@/lib/form-state";
import type { AppRole } from "@/lib/types";

// Admin-only actions. Each one checks the caller is an Admin first. Changes to
// app data go through the caller's own session, so the history records who did
// them; the full-access admin client is used only for the login itself
// (email, password, blocking sign-in), which only Supabase Auth can change.

const ROLES: AppRole[] = ["admin", "updates_manager", "leave_cover", "viewer"];
const MIN_PASSWORD = 8;

// Turns a brand's Leave Mode on or off.
export async function setLeaveMode(formData: FormData) {
  await requireAdmin();
  const brandId = String(formData.get("brandId"));
  const on = formData.get("on") === "true";

  const supabase = await createClient();
  const { error } = await supabase.from("brands").update({ leave_mode_on: on }).eq("id", brandId);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// Creates a login for a team member with a temporary password the Admin chooses.
export async function createLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const personId = String(formData.get("personId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as AppRole;

  if (!personId) return fail("Choose the team member.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email address.");
  if (password.length < MIN_PASSWORD) return fail(`The temporary password needs at least ${MIN_PASSWORD} characters.`);
  if (!ROLES.includes(role)) return fail("Choose a role.");

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // no confirmation email: the Admin hands over the password
  });
  if (authError || !created.user) {
    return fail(authError?.message.includes("already") ? "That email already has a login." : authError?.message ?? "Could not create the login.");
  }

  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ user_id: created.user.id, person_id: personId, email, app_role: role });
  if (profileError) {
    // Undo the half-made login so the Admin can simply try again.
    await admin.auth.admin.deleteUser(created.user.id);
    return fail(profileError.message.includes("person_id") ? "That team member already has a login." : profileError.message);
  }

  revalidatePath("/admin");
  return ok(`Login created for ${email}. Give them the temporary password and ask them to change it under "My account".`);
}

// Switches a login off (they can no longer sign in) or back on.
export async function setLoginActive(formData: FormData) {
  const me = await requireAdmin();
  const userId = String(formData.get("userId"));
  const active = formData.get("active") === "true";
  if (userId === me.userId) throw new Error("You can't deactivate your own login.");

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: active }).eq("user_id", userId);
  if (error) throw new Error(error.message);

  // Also block or unblock sign-in itself.
  const admin = createAdminClient();
  await admin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  revalidatePath("/admin");
}

// Sets a new temporary password for someone who has forgotten theirs.
export async function resetPassword(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return fail(`At least ${MIN_PASSWORD} characters.`);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return fail(error.message);
  return ok("Password reset. Share it with them privately.");
}
