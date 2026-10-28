import type { NextConfig } from "next";

// Every page in this dashboard is behind a login and shows live data, so pages are
// always rendered fresh on request. That is Next.js's default when cacheComponents is off.
const nextConfig: NextConfig = {
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
