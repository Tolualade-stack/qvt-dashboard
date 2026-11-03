import Link from "next/link";
import { SEVERITY_TONES, type Flag } from "@/lib/flags";

// A list of flags: what's late, by how much, and who to escalate to. Each one
// opens the item to fix.
export function FlagList({ flags, brandName }: { flags: Flag[]; brandName?: (id: string) => string }) {
  return (
    <ul className="space-y-2.5">
      {flags.map((flag) => {
        const tone = SEVERITY_TONES[flag.severity];
        return (
          <li key={flag.id}>
            <Link href={flag.href} className="flex overflow-hidden rounded-[18px] border border-line bg-white transition hover:shadow-md">
              <span aria-hidden="true" className="w-1.5 shrink-0" style={{ backgroundColor: tone.bar }} />
              <span className="flex min-w-0 flex-1 flex-col gap-1 p-3.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: tone.bg, color: tone.fg }}>{tone.label}</span>
                  {brandName && <span className="text-xs font-semibold text-muted">{brandName(flag.brandId)}</span>}
                </span>
                <span className="text-sm leading-snug font-bold">{flag.title}</span>
                <span className="text-xs text-muted">{flag.detail}</span>
                <span className="text-xs font-semibold">
                  Escalate to: <span style={{ color: tone.fg }}>{flag.escalateTo}</span>
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
