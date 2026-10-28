import { describeChange } from "@/lib/history";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";

// A list of "who did what, when", newest first.
export function HistoryList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No changes recorded yet.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {entries.map((entry) => (
        <li key={entry.id} className="py-2 text-sm">
          <span className="font-medium">{entry.changed_by_name}</span> {describeChange(entry)}
          <span className="block text-xs text-slate-500">{formatDateTime(entry.changed_at)}</span>
        </li>
      ))}
    </ul>
  );
}
