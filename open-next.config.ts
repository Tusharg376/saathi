import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incremental cache is configured: Saathi has no ISR or revalidation, and its prerendered
// pages ship in the build output. Add an R2 cache here only if that changes
// (https://opennext.js.org/cloudflare/caching).
export default defineCloudflareConfig({});
