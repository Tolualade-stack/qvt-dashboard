// Sets the login rules for the project. Safe to run more than once.
// Usage: npm run db:configure-auth [-- https://your-live-site-address]
//
// - Public sign-ups are switched off: only the Admin can create logins.
// - Passwords must be at least 8 characters.
// - The site address is where Supabase sends people back to after login emails
//   (we do not send any yet, but it must point at the real site once it is live).

import { updateAuthConfig } from "./supabase-api.mjs";

const siteUrl = process.argv[2] ?? "http://localhost:3000";

await updateAuthConfig({
  disable_signup: true,
  password_min_length: 8,
  site_url: siteUrl,
});

console.log(`Login settings saved: sign-ups off, 8+ character passwords, site address ${siteUrl}`);
