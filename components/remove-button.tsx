"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// A "Remove" button that asks once more before doing it, so nothing goes by a
// stray tap. Optionally moves to another page afterwards.
export function RemoveButton({
  label = "Remove",
  confirm = "Tap again to remove",
  action,
  goTo,
  className = "",
}: {
  label?: string;
  confirm?: string;
  action: () => Promise<{ ok: boolean; message: string }>;
  goTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function tap() {
    if (!asking) {
      setAsking(true);
      return;
    }
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setProblem(result.message);
        setAsking(false);
        return;
      }
      if (goTo) router.push(goTo);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={tap}
          className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition disabled:opacity-50 ${asking ? "border-red-700 bg-red-700 text-white" : "border-red-200 bg-white text-red-700"} ${className}`}
        >
          {pending ? "Removing…" : asking ? confirm : label}
        </button>
        {asking && !pending && (
          <button type="button" onClick={() => setAsking(false)} className="min-h-11 px-2 text-sm font-semibold text-muted underline">
            Cancel
          </button>
        )}
      </span>
      {problem && <span role="alert" className="text-xs font-medium text-red-700">{problem}</span>}
    </span>
  );
}
