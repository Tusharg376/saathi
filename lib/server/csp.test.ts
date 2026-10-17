import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./csp";

const policy = contentSecurityPolicy();
const directive = (name: string) =>
  policy
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.split(" ")
    .slice(1);

describe("contentSecurityPolicy", () => {
  it("only loads things from this app by default", () => {
    expect(directive("default-src")).toEqual(["'self'"]);
  });

  it("only sends data to this app: the AI is called from the server, never from the browser", () => {
    expect(directive("connect-src")).toEqual(["'self'"]);
  });

  it("allows no plugins, no framing and no change of base address", () => {
    expect(directive("object-src")).toEqual(["'none'"]);
    expect(directive("frame-ancestors")).toEqual(["'none'"]);
    expect(directive("base-uri")).toEqual(["'self'"]);
    expect(directive("form-action")).toEqual(["'self'"]);
  });

  it("never allows eval or scripts from other websites", () => {
    expect(policy).not.toContain("unsafe-eval");
    expect(directive("script-src")).toEqual(["'self'", "'unsafe-inline'"]);
    expect(policy).not.toMatch(/https?:\/\//);
  });

  it("lets a worker's own photo be shown back to them", () => {
    expect(directive("img-src")).toContain("blob:");
  });

  it("only loads fonts, the manifest and the offline worker from this app", () => {
    for (const name of ["font-src", "manifest-src", "worker-src"]) expect(directive(name)).toEqual(["'self'"]);
  });

  it("does not use upgrade-insecure-requests, which stops the offline worker loading on http://localhost", () => {
    expect(policy).not.toContain("upgrade-insecure-requests");
  });
});
