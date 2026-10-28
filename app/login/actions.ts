"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fail, type FormState } from "@/lib/form-state";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return fail("Enter your email and password.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  // Same message for a wrong email or a wrong password, so the form does not
  // reveal which emails have logins.
  if (error) return fail("That email and password don't match. Ask the Admin if you need a reset.");

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
