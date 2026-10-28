import type { AuditEntry } from "@/lib/types";

// Turns a raw audit_log row into a short sentence for the history lists,
// e.g. "turned Leave Mode on for Alieve".

const FIELD_LABELS: Record<string, string> = {
  canva_calendar_url: "Canva calendar link",
  leave_mode_on: "Leave Mode",
  leave_cover_person_id: "leave cover person",
  app_role: "role",
  is_active: "active status",
  person_id: "linked team member",
  full_name: "name",
  title: "job title",
  responsibilities: "responsibilities",
};

const IGNORED_FIELDS = new Set(["created_at", "created_by", "updated_at", "updated_by"]);

function changedFields(entry: AuditEntry): string[] {
  const before = entry.old_data ?? {};
  const after = entry.new_data ?? {};
  return Object.keys(after).filter(
    (key) => !IGNORED_FIELDS.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

export function describeChange(entry: AuditEntry): string {
  const row = entry.new_data ?? entry.old_data ?? {};
  const label = String(row.name ?? row.full_name ?? row.email ?? row.title ?? "");

  if (entry.table_name === "brands" && entry.action === "update") {
    const fields = changedFields(entry);
    if (fields.length === 1 && fields[0] === "leave_mode_on") {
      return `turned Leave Mode ${entry.new_data?.leave_mode_on ? "on" : "off"} for ${label}`;
    }
    if (fields.length === 1 && fields[0] === "canva_calendar_url") {
      return entry.new_data?.canva_calendar_url
        ? `set the Canva calendar link for ${label}`
        : `removed the Canva calendar link for ${label}`;
    }
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
  const fields = entry.action === "update" ? changedFields(entry).map((f) => FIELD_LABELS[f] ?? f.replaceAll("_", " ")) : [];
  return `${verb} ${label || entry.table_name}${fields.length ? ` (${fields.join(", ")})` : ""}`;
}
