// Overdue and SLA flags, worked out from a world's tracked work, each with who to
// escalate to. The escalation ladder (from the Master Process Framework):
//   task owner -> Digital Lead -> Account Manager -> leave cover (only while
//   Leave Mode is on, as the final backstop)
// Brands without a Digital Lead (e.g. partnership-led ones) go straight to the
// Account Manager.
//
// Rules:
//   asset first draft   from "Copy ready": warn, escalate to Digital Lead, hard
//                       escalate to Account Manager, at the brand's own times
//                       (hours, or working days for Alieve)
//   content past date   planned date passed and not posted
//   revision round 4    needs a direct client conversation
//   ad issue            open: warning; after 24 h: escalate
//   fund request        pending more than 24 h
//   report overdue      not sent by its due time
//   no update in 24 h   nothing recorded on the world for a day

import type { Brand } from "@/lib/types";
import type { ContentItem } from "@/lib/content";
import type { Ad, FundRequest } from "@/lib/ads";
import { money } from "@/lib/ads";
import { REPORT_KIND_LABELS, type Report } from "@/lib/reports";

export type Severity = "warning" | "overdue" | "critical";

export type Flag = {
  id: string;
  brandId: string;
  severity: Severity;
  title: string;
  detail: string;
  escalateTo: string;      // e.g. "Viche (Digital Lead)"
  href: string;            // where to fix it
  since: string;           // when the clock started
};

export type TeamMember = { personId: string; name: string; roleKey: string; title: string };

const HOUR = 3_600_000;

// Working days (Monday to Friday, Lagos time) between two moments.
export function workingDaysBetween(fromIso: string, now: number): number {
  const lagos = (t: number) => new Date(t + HOUR);
  let day = lagos(new Date(fromIso).getTime());
  const end = lagos(now);
  let count = 0;
  while (day < end) {
    const next = new Date(day.getTime() + 24 * HOUR);
    const weekday = day.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += (Math.min(next.getTime(), end.getTime()) - day.getTime()) / (24 * HOUR);
    day = next;
  }
  return count;
}

const rank: Record<Severity, number> = { critical: 0, overdue: 1, warning: 2 };
export const sortFlags = (flags: Flag[]) => [...flags].sort((a, b) => rank[a.severity] - rank[b.severity] || a.since.localeCompare(b.since));

export const SEVERITY_TONES: Record<Severity, { bg: string; fg: string; bar: string; label: string }> = {
  critical: { bg: "#FDE7E7", fg: "#A11A1A", bar: "#C62828", label: "Escalate now" },
  overdue: { bg: "#FFEBD9", fg: "#8A3B00", bar: "#E8590C", label: "Overdue" },
  warning: { bg: "#FFF3D6", fg: "#7A4B00", bar: "#E0A800", label: "Heads up" },
};

export function computeFlags(input: {
  brand: Brand;
  team: TeamMember[];
  content: ContentItem[];
  ads: Ad[];
  funds: FundRequest[];
  reports: Report[];
  issues?: { id: string; title: string; note: string | null; raised_at: string; resolved_at: string | null }[];
  lastActivity: string | null;
  now: number;
}): Flag[] {
  const { brand, team, now } = input;
  const flags: Flag[] = [];
  const nameOf = (personId: string | null) => team.find((t) => t.personId === personId)?.name ?? null;
  const withRole = (key: string) => team.filter((t) => t.roleKey === key);
  const label = (members: TeamMember[], role: string) => (members.length ? `${members.map((m) => m.name).join(" or ")} (${role})` : null);

  const leaveCover = brand.leave_mode_on ? team.find((t) => t.personId === brand.leave_cover_person_id) : undefined;
  const accountManager = label(withRole("account_manager"), "Account Manager") ?? "the Account Manager";
  const digitalLead = label(withRole("digital_lead"), "Digital Lead");
  // Who to escalate to at each level of the ladder.
  const ladder = {
    owner: (personId: string | null) => (nameOf(personId) ? `${nameOf(personId)} (owner)` : digitalLead ?? accountManager),
    lead: () => digitalLead ?? accountManager,
    top: () => (leaveCover ? `${accountManager}; on leave, so ${leaveCover.name} (leave cover)` : accountManager),
  };
  const hoursSince = (iso: string) => (now - new Date(iso).getTime()) / HOUR;

  // 1. Asset first draft, counted from "Copy ready".
  for (const item of input.content) {
    if (item.is_archived || !item.copy_ready_at || !["copy_ready", "asset_in_progress"].includes(item.status)) continue;
    const working = brand.asset_sla_unit === "working_days";
    const elapsed = working ? workingDaysBetween(item.copy_ready_at, now) : hoursSince(item.copy_ready_at);
    const unit = working ? "working days" : "h";
    const shown = working ? elapsed.toFixed(1).replace(/\.0$/, "") : String(Math.floor(elapsed));
    const target = working ? `${brand.asset_sla_hard} working days` : `${brand.asset_sla_escalate} h`;
    let severity: Severity | null = null;
    if (elapsed >= brand.asset_sla_hard) severity = "critical";
    else if (elapsed >= brand.asset_sla_escalate) severity = "overdue";
    else if (elapsed >= brand.asset_sla_warn) severity = "warning";
    if (!severity) continue;
    flags.push({
      id: `asset-${item.id}`,
      brandId: brand.id,
      severity,
      title: `Asset draft late: ${item.title}`,
      detail: `${shown} ${unit} since copy was ready (first draft due within ${target}).`,
      escalateTo: severity === "critical" ? ladder.top() : severity === "overdue" ? ladder.lead() : ladder.owner(item.owner_person_id),
      href: `/brands/${brand.id}/content/${item.id}`,
      since: item.copy_ready_at,
    });
  }

  // 2. Content past its planned date, and 3. revision round 4.
  const today = new Date(now + HOUR).toISOString().slice(0, 10);
  for (const item of input.content) {
    if (item.is_archived || item.status === "posted") continue;
    if (item.planned_date && item.planned_date < today) {
      const daysLate = Math.round((new Date(today).getTime() - new Date(item.planned_date).getTime()) / (24 * HOUR));
      flags.push({
        id: `late-${item.id}`,
        brandId: brand.id,
        severity: daysLate >= 3 ? "critical" : "overdue",
        title: `Not posted yet: ${item.title}`,
        detail: `Planned for ${item.planned_date}, ${daysLate} ${daysLate === 1 ? "day" : "days"} ago. Now at "${item.status.replaceAll("_", " ")}".`,
        escalateTo: daysLate >= 3 ? ladder.top() : ladder.lead(),
        href: `/brands/${brand.id}/content/${item.id}`,
        since: `${item.planned_date}T00:00:00Z`,
      });
    }
    if (item.revision_round >= 4) {
      flags.push({
        id: `rounds-${item.id}`,
        brandId: brand.id,
        severity: "critical",
        title: `Round ${item.revision_round} of revisions: ${item.title}`,
        detail: "Four rounds reached: this needs a direct client conversation, not another round.",
        escalateTo: ladder.top(),
        href: `/brands/${brand.id}/content/${item.id}`,
        since: item.status_changed_at,
      });
    }
  }

  // 4. Ad issues (underperformance), and 5. fund requests.
  for (const ad of input.ads) {
    if (!ad.issue_raised_at) continue;
    const h = hoursSince(ad.issue_raised_at);
    flags.push({
      id: `issue-${ad.id}`,
      brandId: brand.id,
      severity: h >= 24 ? "overdue" : "warning",
      title: `Ad issue: ${ad.name}`,
      detail: `${ad.issue_note ?? "Underperforming"}. Raised ${Math.floor(h)} h ago${h >= 24 ? ", past the 24 h window" : `; escalate in ${Math.ceil(24 - h)} h if not fixed`}.`,
      escalateTo: h >= 24 ? ladder.lead() : ladder.owner(ad.owner_person_id),
      href: `/brands/${brand.id}/ads/${ad.id}`,
      since: ad.issue_raised_at,
    });
  }
  const finance = label(withRole("finance"), "Finance Manager") ?? "the Finance Manager";
  for (const f of input.funds) {
    const h = hoursSince(f.requested_at);
    if (h < 24) continue;
    flags.push({
      id: `funds-${f.id}`,
      brandId: brand.id,
      severity: h >= 48 ? "critical" : "overdue",
      title: `Fund request pending: ${money(Number(f.amount), f.currency)}`,
      detail: `Requested ${Math.floor(h)} h ago and still not funded. Ads may stop.`,
      escalateTo: h >= 48 ? (leaveCover ? `${finance}, then ${leaveCover.name} (leave cover)` : `${finance}, then ${ladder.lead()}`) : finance,
      href: f.ad_id ? `/brands/${brand.id}/ads/${f.ad_id}` : `/brands/${brand.id}/update?tab=ads`,
      since: f.requested_at,
    });
  }

  // 6. Reports not sent by their due time.
  for (const r of input.reports) {
    if (r.sent_at || new Date(r.due_at).getTime() > now) continue;
    const h = hoursSince(r.due_at);
    flags.push({
      id: `report-${r.id}`,
      brandId: brand.id,
      severity: r.kind === "monthly" || h >= 48 ? "critical" : "overdue",
      title: `${REPORT_KIND_LABELS[r.kind]} overdue: ${r.period_label}`,
      detail: `Was due ${Math.floor(h) < 24 ? `${Math.max(1, Math.floor(h))} h` : `${Math.floor(h / 24)} days`} ago.`,
      escalateTo: r.kind === "monthly" ? ladder.top() : ladder.lead(),
      href: `/brands/${brand.id}/update?tab=reports`,
      since: r.due_at,
    });
  }

  // Issues raised on any other work, on the same 24-hour clock as ad issues.
  for (const issue of input.issues ?? []) {
    if (issue.resolved_at) continue;
    const h = hoursSince(issue.raised_at);
    flags.push({
      id: `work-issue-${issue.id}`,
      brandId: brand.id,
      severity: h >= 24 ? "overdue" : "warning",
      title: `Issue: ${issue.title}`,
      detail: `${issue.note ? `${issue.note}. ` : ""}Raised ${Math.floor(h)} h ago${h >= 24 ? ", past the 24 h window" : `; escalate in ${Math.ceil(24 - h)} h if not fixed`}.`,
      escalateTo: h >= 24 ? ladder.top() : ladder.lead(),
      href: "/work",
      since: issue.raised_at,
    });
  }

  // 7. Nothing recorded on the world for 24 hours.
  if (input.lastActivity && hoursSince(input.lastActivity) >= 24) {
    const h = hoursSince(input.lastActivity);
    flags.push({
      id: `stale-${brand.id}`,
      brandId: brand.id,
      severity: h >= 72 ? "overdue" : "warning",
      title: "No update for " + (h < 48 ? `${Math.floor(h)} h` : `${Math.floor(h / 24)} days`),
      detail: "Nothing has been logged on this world. A quick note on the Update screen keeps everyone informed.",
      escalateTo: h >= 72 ? ladder.lead() : "the Updates Manager",
      href: `/brands/${brand.id}/update?tab=note`,
      since: input.lastActivity,
    });
  }

  return sortFlags(flags);
}
