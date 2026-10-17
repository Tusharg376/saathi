import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Saathi · साथी",
    short_name: "Saathi",
    description:
      "A multilingual companion for delivery partners, drivers and daily-wage workers: earnings, safety, rights and schemes, papers and complaints in simple language.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f1f2ef",
    theme_color: "#f6c700",
    lang: "hi",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      // The plate sits inside the central 62%, so the same art is safe for circular masks.
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the home-screen icon: one tap to the two things needed fastest.
    shortcuts: [
      { name: "Emergency", short_name: "SOS", url: "/sos", icons: [{ src: "/icons/192", sizes: "192x192", type: "image/png" }] },
      { name: "Earnings", url: "/earnings", icons: [{ src: "/icons/192", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
