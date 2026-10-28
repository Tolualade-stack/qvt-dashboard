// Settings read from environment variables (.env.local on your computer,
// Netlify's "Environment variables" page on the live site).
// NEXT_PUBLIC_ values are safe to reach the browser; the secret key never is.

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Add it to .env.local (see .env.example).`);
  }
  return value;
}

export const env = {
  // Written out in full so Next.js can include them in browser code.
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
};

// Server only. A function, so the value is read only where it is actually used.
export function secretKey(): string {
  return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
}
