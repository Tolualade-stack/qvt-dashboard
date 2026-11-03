import { env } from "@/lib/env";

// Brand banners and logos live in the public "brand-media" storage bucket.
export const MEDIA_BUCKET = "brand-media";

export function mediaUrl(path: string | null): string | null {
  return path ? `${env.supabaseUrl}/storage/v1/object/public/${MEDIA_BUCKET}/${path}` : null;
}
