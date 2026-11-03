// "What changed?" notes: updates that happened in conversation, logged so they
// are not lost. Each records who wrote it and when.

export type NoteSource = "call" | "whatsapp" | "in_person" | "email" | "other";

export type UpdateNote = {
  id: string;
  brand_id: string;
  content_item_id: string | null;
  source: NoteSource | null;
  note: string;
  author_name: string;
  created_at: string;
};

export const SOURCE_LABELS: Record<NoteSource, string> = {
  call: "Call",
  whatsapp: "WhatsApp",
  in_person: "In person",
  email: "Email",
  other: "Other",
};
