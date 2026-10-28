"use client";

import { useActionState } from "react";
import { saveCanvaLink } from "./actions";
import { Button, FormMessage, inputClass } from "@/components/ui";

export function CanvaLinkForm({ brandId, currentUrl }: { brandId: string; currentUrl: string }) {
  const [state, formAction, pending] = useActionState(saveCanvaLink.bind(null, brandId), null);

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <label className="block">
        <span className="mb-1 block text-xs text-slate-500">Paste this month&apos;s Canva link (leave empty to remove)</span>
        <input name="url" type="url" defaultValue={currentUrl} placeholder="https://www.canva.com/…" className={inputClass} />
      </label>
      <FormMessage state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Save link"}
      </Button>
    </form>
  );
}
