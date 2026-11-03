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
  workspace_id: string;
  is_archived: boolean;
  about: string | null;
  website: string | null;
  industry: string | null;
  category: string | null;
  products: string[];
  updated_at: string;
};

export type Workspace = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

export type Person = {
  id: string;
  slug: string;
  full_name: string;
  is_placeholder: boolean;
  is_active: boolean;
  workspace_id: string;
};

// A standard role from the workspace's editable catalogue.
export type CatalogueRole = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  role_key: RoleKey;
  sort_order: number;
  is_active: boolean;
};

// One person's job on one brand. ended_at is set when they move off it.
export type BrandRole = {
  id: string;
  brand_id: string;
  person_id: string;
  role_id: string | null;
  role_key: string;
  title: string;
  responsibilities: string | null;
  sort_order: number;
  started_at: string;
  ended_at: string | null;
};

export type RoleKey =
  | "account_manager" | "account_deputy" | "digital_lead" | "channel_manager" | "digital_executive"
  | "creative" | "kol_lead" | "partnerships" | "quality_assurance" | "finance" | "buying" | "support" | "other";

// What each kind of role means for escalation (shown when adding a role).
export const ROLE_KEY_LABELS: Record<RoleKey, string> = {
  account_manager: "Account Manager",
  account_deputy: "Account Deputy / leave cover",
  digital_lead: "Digital Lead",
  channel_manager: "Channel Manager",
  digital_executive: "Digital Executive",
  creative: "Creative",
  kol_lead: "Influencer / KOL",
  partnerships: "Partnerships",
  quality_assurance: "Quality assurance",
  finance: "Finance",
  buying: "Media buying",
  support: "Support",
  other: "Other",
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
