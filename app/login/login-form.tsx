"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
