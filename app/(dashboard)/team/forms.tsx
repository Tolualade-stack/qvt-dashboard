"use client";

import { useActionState, useState } from "react";
import { addPerson, addRole, assignRole } from "./actions";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";
import { ROLE_KEY_LABELS, type RoleKey } from "@/lib/types";

type Option = { id: string; name: string };

export function AddPersonForm() {
  const [state, formAction, pending] = useActionState(addPerson, null);
  return (
    <form action={formAction} className="space-y-3">
      <Field label="Name">
        <input name="name" required autoComplete="off" className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add team member"}</Button>
    </form>
  );
}

// Collapsed by default so the team list stays short on a phone.
export function AssignForm({ personId, brands, roles }: { personId: string; brands: Option[]; roles: Option[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(assignRole.bind(null, personId), null);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="min-h-10">
        + Assign to a brand
      </Button>
    );
  }
  return (
    <form action={formAction} className="mt-2 space-y-3 rounded-2xl bg-mist p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Brand">
          <select name="brandId" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose…</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Field label="Role">
          <select name="roleId" required defaultValue="" className={inputClass}>
            <option value="" disabled>Choose…</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Focus (optional)" hint="Adds detail to the role's label, e.g. TikTok, or Meta and Google.">
        <input name="focus" autoComplete="off" className={inputClass} />
      </Field>
      <Field label="Responsibilities (optional)" hint="Leave empty to use the role's standard description.">
        <input name="responsibilities" autoComplete="off" className={inputClass} />
      </Field>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Assign"}</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Close</Button>
      </div>
    </form>
  );
}

export function AddRoleForm() {
  const [state, formAction, pending] = useActionState(addRole, null);
  return (
    <form action={formAction} className="space-y-3">
      <Field label="Role name">
        <input name="name" required autoComplete="off" className={inputClass} />
      </Field>
      <Field label="What it does (optional)">
        <input name="description" autoComplete="off" className={inputClass} />
      </Field>
      <Field label="Kind of role" hint="Used for the escalation ladder, e.g. a Digital Lead is the first escalation.">
        <select name="roleKey" defaultValue="other" className={inputClass}>
          {(Object.keys(ROLE_KEY_LABELS) as RoleKey[]).map((key) => (
            <option key={key} value={key}>{ROLE_KEY_LABELS[key]}</option>
          ))}
        </select>
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add role"}</Button>
    </form>
  );
}
