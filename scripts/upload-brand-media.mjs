// Uploads a banner or logo image for a brand and links it to the brand.
// The app's own "Edit world" screen does the same; this is for setup and bulk loads.
// Usage: npm run db:upload-media -- <brand id> <banner|logo> <image file>

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createClient } from "@supabase/supabase-js";

const [brandId, kind, file] = process.argv.slice(2);
if (!brandId || !["banner", "logo"].includes(kind) || !file) {
  console.error("Usage: npm run db:upload-media -- <brand id> <banner|logo> <image file>");
  process.exit(1);
}

const types = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const contentType = types[extname(file).toLowerCase()];
if (!contentType) {
  console.error("Use a .png, .jpg or .webp image.");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// A new file name each time, so phones never show an old cached image.
const path = `${brandId}/${kind}-${Date.now()}${extname(file).toLowerCase()}`;
const { error: uploadError } = await supabase.storage
  .from("brand-media")
  .upload(path, await readFile(file), { contentType, upsert: false });
if (uploadError) throw uploadError;

const { error } = await supabase.from("brands").update({ [`${kind}_path`]: path }).eq("id", brandId);
if (error) throw error;
console.log(`Uploaded ${kind} for ${brandId}: ${path}`);
