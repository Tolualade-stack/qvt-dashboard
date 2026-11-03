import type { AuditEntry } from "@/lib/types";
import { STATUS_LABELS, type ContentStatus } from "@/lib/content";
import { AD_STATUS_LABELS, money, type AdStatus, type Currency } from "@/lib/ads";

// Turns a raw audit_log row into a short sentence for the history lists,
// e.g. "turned Leave Mode on for Alieve".

const FIELD_LABELS: Record<string, string> = {
  canva_calendar_url: "Canva calendar link",
  banner_path: "banner",
  logo_path: "logo",
  colour: "main colour",
  palette: "logo colours",
  marketing_types: "marketing types",
  channels: "channels",
  about: "about",
  products: "products",
  sort_order: "order on Home",
  is_archived: "archived",
  monthly_content_target_min: "content target",
  monthly_content_target_max: "content target",
  creative_assets_target: "creative assets target",
  leave_mode_on: "Leave Mode",
  leave_cover_person_id: "leave cover person",
  app_role: "role",
  is_active: "active status",
  person_id: "linked team member",
  full_name: "name",
  title: "title",
  platforms: "platforms",
  owner_person_id: "owner",
  planned_date: "planned date",
  needs_approval: "approval",
  post_url: "post link",
  notes: "notes",
  responsibilities: "responsibilities",
};

const IGNORED_FIELDS = new Set([
  "created_at", "created_by", "updated_at", "updated_by",
  // Set automatically alongside a status change.
  "status_changed_at", "copy_ready_at", "posted_at", "revision_round",
  "went_live_at", "ended_at", "spend_updated_at", "issue_note", "resolved_at", "requested_at",
]);

function changedFields(entry: AuditEntry): string[] {
  const before = entry.old_data ?? {};
  const after = entry.new_data ?? {};
  return Object.keys(after).filter(
    (key) => !IGNORED_FIELDS.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

// Who made the change. Changes made by setup scripts (no login) read "PRIME setup".
export function whoDidIt(entry: AuditEntry): string {
  return entry.changed_by_name === "System" ? "PRIME setup" : entry.changed_by_name;
}

export function describeChange(entry: AuditEntry): string {
  const row = entry.new_data ?? entry.old_data ?? {};
  const label = String(row.name ?? row.full_name ?? row.email ?? row.title ?? "");

  if (entry.table_name === "brands" && entry.action === "update") {
    const fields = changedFields(entry);
    if (fields.length === 1 && fields[0] === "leave_mode_on") {
      return `turned Leave Mode ${entry.new_data?.leave_mode_on ? "on" : "off"} for ${label}`;
    }
    if (fields.length === 1 && fields[0] === "is_archived") {
      return `${entry.new_data?.is_archived ? "archived" : "restored"} ${label}`;
    }
    if (fields.length === 1 && fields[0] === "canva_calendar_url") {
      return entry.new_data?.canva_calendar_url
        ? `set the Canva calendar link for ${label}`
        : `removed the Canva calendar link for ${label}`;
    }
  }

  if (entry.table_name === "update_notes") {
    const note = String(entry.new_data?.note ?? entry.old_data?.note ?? "");
    const short = note.length > 90 ? `${note.slice(0, 90)}…` : note;
    return entry.action === "delete" ? "removed an update" : `noted: "${short}"`;
  }

  if (entry.table_name === "ads") {
    if (entry.action === "insert") return `added the ad "${label}"`;
    const fields = changedFields(entry);
    if (fields.includes("status")) {
      return `moved the ad "${label}" to ${AD_STATUS_LABELS[entry.new_data?.status as AdStatus] ?? entry.new_data?.status}`;
    }
    if (fields.includes("issue_raised_at")) {
      return entry.new_data?.issue_raised_at ? `raised an issue on "${label}": ${entry.new_data?.issue_note}` : `resolved the issue on "${label}"`;
    }
    if (fields.length === 1 && fields[0] === "spend_to_date") {
      return `updated spend on "${label}" to ${money(Number(entry.new_data?.spend_to_date), entry.new_data?.currency as Currency)}`;
    }
  }

  if (entry.table_name === "fund_requests") {
    const amount = money(Number(row.amount), row.currency as Currency);
    if (entry.action === "insert") return `requested ${amount} in funds`;
    if (changedFields(entry).includes("status")) return `marked the ${amount} fund request as ${entry.new_data?.status}`;
  }

  if (entry.table_name === "content_items") {
    if (entry.action === "insert") return `added "${label}"`;
    const fields = changedFields(entry);
    if (fields.includes("status")) {
      const to = STATUS_LABELS[entry.new_data?.status as ContentStatus] ?? String(entry.new_data?.status);
      const sentBack = entry.old_data?.status === "awaiting_approval" && entry.new_data?.status === "asset_in_progress";
      return sentBack ? `sent "${label}" back for changes (round ${entry.new_data?.revision_round})` : `moved "${label}" to ${to}`;
    }
    if (fields.length === 1 && fields[0] === "post_url") return `added the post link for "${label}"`;
  }

  if (entry.table_name === "profiles") {
    if (entry.action === "insert") return `created a login for ${label}`;
    if (entry.action === "delete") return `removed the login for ${label}`;
    const fields = changedFields(entry);
    if (fields.length === 1 && fields[0] === "is_active") {
      return `${entry.new_data?.is_active ? "reactivated" : "deactivated"} the login for ${label}`;
    }
  }

  const verb = { insert: "added", update: "updated", delete: "removed" }[entry.action];
  const fields =
    entry.action === "update" ? [...new Set(changedFields(entry).map((f) => FIELD_LABELS[f] ?? f.replaceAll("_", " ")))] : [];
  return `${verb} ${label || entry.table_name}${fields.length ? ` (${fields.join(", ")})` : ""}`;
}
