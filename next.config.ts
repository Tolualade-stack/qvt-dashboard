import type { NextConfig } from "next";

// Every page in this dashboard is behind a login and shows live data, so pages are
// always rendered fresh on request. That is Next.js's default when cacheComponents is off.
const nextConfig: NextConfig = {
  // Brand banners and logos come from the project's public storage bucket.
  images: {
    remotePatterns: [new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/**`)],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
