"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, null);

  return (
    <form action={formAction} className="space-y-3">
      <Field label="New password" hint="At least 8 characters.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="Type it again">
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Change password"}</Button>
    </form>
  );
}
