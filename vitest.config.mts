import { defineConfig } from "vitest/config";

const alias = { "@": import.meta.dirname };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        // Pure logic and the server handlers: no browser needed.
        resolve: { alias },
        test: {
          name: "logic",
          environment: "node",
          include: ["lib/**/*.test.ts", "app/**/*.test.ts", "evals/**/*.test.ts"],
          exclude: ["evals/live/**"],
        },
      },
      {
        // Screens and hooks, rendered in a simulated browser with a real accessibility check.
        resolve: { alias },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["components/**/*.test.{ts,tsx}", "lib/**/*.test.tsx", "app/**/*.test.tsx"],
          setupFiles: ["./test/setup-ui.ts"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        // The root layout loads its fonts through next/font/google, which only exists inside the Next.js
        // compiler, so it cannot be imported in a unit test. Its parts (provider, shell, prefs, worker
        // registration) are tested on their own; the whole page is checked in a real browser (Lighthouse + axe).
        "app/layout.tsx",
      ],
      reporter: ["text-summary", "json-summary"],
      // A couple of points under what the suite measures today (statements 98.8, branches 95.5, functions 99.2, lines 99.7): a real
      // regression fails CI, normal churn does not. Raise these when coverage rises; never lower them to pass.
      thresholds: { statements: 96, branches: 93, functions: 97, lines: 97 },
    },
  },
});
