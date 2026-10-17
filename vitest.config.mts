import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "evals/**/*.test.ts"],
    exclude: ["evals/live/**"],
  },
  resolve: {
    alias: { "@": import.meta.dirname },
  },
});
