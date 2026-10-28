// Shapes of the database rows used by the app, and the labels shown for them.
// Keep in step with supabase/migrations.

export type AppRole = "admin" | "updates_manager" | "leave_cover" | "viewer";
export type ProcessTier = "heavy" | "medium" | "low";

export type Brand = {
  id: string;
  name: string;
  colour: string;
  tier: ProcessTier;
  scope: string;
  reporting: string;
  in_execution_cycle: boolean;
  monthly_content_target_min: number | null;
  monthly_content_target_max: number | null;
  canva_calendar_url: string | null;
  leave_cover_person_id: string | null;
  leave_mode_on: boolean;
  updated_at: string;
};

export type Person = {
  id: string;
  slug: string;
  full_name: string;
  is_placeholder: boolean;
};

export type BrandRole = {
  id: string;
  brand_id: string;
  person_id: string;
  role_key: string;
  title: string;
  responsibilities: string | null;
  sort_order: number;
};

export type AuditEntry = {
  id: number;
  table_name: string;
  row_id: string;
  action: "insert" | "update" | "delete";
  changed_by_name: string;
  changed_at: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  updates_manager: "Updates Manager",
  leave_cover: "Leave cover",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  admin: "Full access. Manages logins and Leave Mode.",
  updates_manager: "Adds and updates content, ads, reports and updates.",
  leave_cover: "Can edit their brand only while its Leave Mode is on.",
  viewer: "Read-only.",
};

export const TIER_LABELS: Record<ProcessTier, string> = {
  heavy: "Heavy process",
  medium: "Medium process",
  low: "Low process",
};
