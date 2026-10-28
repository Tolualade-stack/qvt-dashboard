"use client";

import { useActionState, useState } from "react";
import { createLogin, resetPassword } from "./actions";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";
import { ROLE_LABELS, type AppRole } from "@/lib/types";

export function CreateLoginForm({ people }: { people: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(createLogin, null);

  if (people.length === 0) {
    return <p className="text-sm text-slate-500">Every team member already has a login.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Team member">
        <select name="personId" required defaultValue="" className={inputClass}>
          <option value="" disabled>Choose…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Their email">
        <input name="email" type="email" required autoComplete="off" className={inputClass} />
      </Field>
      <Field label="Role">
        <select name="role" required defaultValue="" className={inputClass}>
          <option value="" disabled>Choose…</option>
          {(Object.keys(ROLE_LABELS) as AppRole[]).map((role) => (
            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
          ))}
        </select>
      </Field>
      <Field label="Temporary password" hint="At least 8 characters. Share it with them privately; they can change it after signing in.">
        <input name="password" type="text" required minLength={8} autoComplete="off" className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create login"}</Button>
    </form>
  );
}

// Collapsed by default so the logins list stays short on a phone.
export function ResetPasswordForm({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(resetPassword.bind(null, userId), null);

  if (!open) {
    return <Button variant="secondary" type="button" onClick={() => setOpen(true)}>Reset password</Button>;
  }
  return (
    <form action={formAction} className="w-full space-y-2">
      <input name="password" type="text" required minLength={8} placeholder="New temporary password" autoComplete="off" className={inputClass} />
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Set password"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </form>
  );
}
