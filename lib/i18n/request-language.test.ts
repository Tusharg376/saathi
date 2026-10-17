import { beforeEach, describe, expect, it, vi } from "vitest";

const next = vi.hoisted(() => ({ cookie: undefined as string | undefined, acceptLanguage: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "saathi.lang" && next.cookie ? { value: next.cookie } : undefined),
  }),
  headers: async () => new Headers(next.acceptLanguage ? { "accept-language": next.acceptLanguage } : {}),
}));

import { requestLanguage } from "./request-language";

beforeEach(() => {
  next.cookie = undefined;
  next.acceptLanguage = null;
});

describe("requestLanguage: the language of the page being served", () => {
  it("uses the saved choice from the cookie", async () => {
    next.cookie = "mr";
    next.acceptLanguage = "ta";
    expect(await requestLanguage()).toBe("mr");
  });

  it("uses the phone's language when there is no cookie yet", async () => {
    next.acceptLanguage = "gu-IN,en;q=0.5";
    expect(await requestLanguage()).toBe("gu");
  });

  it("is Hindi for a first-time visitor whose phone sends nothing useful", async () => {
    expect(await requestLanguage()).toBe("hi");
  });
});
