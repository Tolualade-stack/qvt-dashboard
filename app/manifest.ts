import type { MetadataRoute } from "next";

// Tells phones this dashboard can be installed: when added to the home screen it
// opens full-screen like an app, with its own icon, instead of in a browser tab.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PRIME",
    short_name: "PRIME",
    description: "Every campaign. Live. Be the first to know.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1f4b",
    theme_color: "#0b1f4b",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
