"use server";

import { createClient } from "@/lib/supabase/server";
import { fail, ok, type FormState } from "@/lib/form-state";

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return fail("Use at least 8 characters.");
  if (password !== confirm) return fail("The two passwords don't match.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error.message);
  return ok("Password changed. Use the new one next time you sign in.");
}
