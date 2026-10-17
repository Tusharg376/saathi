import path from "node:path";
import type { NextConfig } from "next";
import { contentSecurityPolicy } from "./lib/server/csp";

const production = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Off on purpose. Saathi is a client-side, local-first app and uses no `use cache`, so it gains
  // nothing from Cache Components, and with them on the OpenNext Cloudflare worker hangs on every
  // page ("Worker's code had hung"). Turn them back on only after re-testing `npm run preview`.
  cacheComponents: false,
  partialPrefetching: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Camera (document photos), microphone (voice) and location (SOS) are used by this app only.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
          // Production only: React's development tools need eval, and HTTPS-only rules are meaningless on localhost.
          ...(production
            ? [
                { key: "Content-Security-Policy", value: contentSecurityPolicy() },
                { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
                { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
              ]
            : []),
        ],
      },
      {
        // The browser must always re-check the worker, or an update would never reach anyone.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  turbopack: {
    // A stray package-lock.json in the home directory makes Next guess the wrong workspace root.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
