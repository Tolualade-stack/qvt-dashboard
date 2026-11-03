import type { MetadataRoute } from "next";

// Tells phones this dashboard can be installed: when added to the home screen it
// opens full-screen like an app, with its own icon, instead of in a browser tab.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "QVT Campaign Dashboard",
    short_name: "QVT Dashboard",
    description: "Live status of content, ads and reports for QVT Media's Team 1 brands.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
