import { describe, expect, it } from "vitest";
import { LANG_COOKIE, pickLanguage } from "./pick-language";

describe("pickLanguage: the language the first page is written in", () => {
  it("uses the language the worker chose last time, whatever the phone says", () => {
    expect(pickLanguage("bn", "ta-IN,ta;q=0.9,en;q=0.8")).toBe("bn");
  });

  it("ignores a saved value that is not one of the app's languages", () => {
    expect(pickLanguage("klingon", "te-IN")).toBe("te");
    expect(pickLanguage("", "gu")).toBe("gu");
  });

  it("with nothing saved, follows the phone's most preferred language the app offers", () => {
    expect(pickLanguage(undefined, "ta-IN,en;q=0.5")).toBe("ta");
    expect(pickLanguage(undefined, "kn")).toBe("kn");
  });

  it("honours the phone's own ranking, not just the order it was written in", () => {
    expect(pickLanguage(undefined, "en;q=0.4, mr;q=0.9")).toBe("mr");
    expect(pickLanguage(undefined, "en-US,en;q=0.9,hi;q=0.8")).toBe("en");
  });

  it("keeps the written order when two languages are equally preferred", () => {
    expect(pickLanguage(undefined, "te;q=0.8, kn;q=0.8")).toBe("te");
  });

  it("skips languages the app lacks and falls through to the next one it has", () => {
    expect(pickLanguage(undefined, "fr-FR, de;q=0.9, bn;q=0.5")).toBe("bn");
  });

  it("never picks a language the phone said it does not want (q=0)", () => {
    expect(pickLanguage(undefined, "hi;q=0, en;q=0.1")).toBe("en");
  });

  it("falls back to Hindi when nothing matches or nothing is sent", () => {
    expect(pickLanguage(undefined, "fr-FR, de")).toBe("hi");
    expect(pickLanguage(undefined, "*")).toBe("hi");
    expect(pickLanguage(undefined, undefined)).toBe("hi");
    expect(pickLanguage(undefined, null)).toBe("hi");
    expect(pickLanguage(undefined, "")).toBe("hi");
  });

  it("is not thrown by a badly written header", () => {
    expect(pickLanguage(undefined, "en;q=banana, ta")).toBe("ta"); // an unreadable weight counts as 0
    expect(pickLanguage(undefined, ",,,;;;, ;q=1, en")).toBe("en");
    expect(pickLanguage(undefined, "EN-gb")).toBe("en"); // capitals are fine
  });

  it("reads only the first part of an oversized header, which came from the network and is not trusted", () => {
    const padding = "xx;q=0.1,".repeat(100); // far past the limit
    expect(pickLanguage(undefined, `${padding}ta`)).toBe("hi");
  });

  it("names the cookie the page and the server share", () => {
    expect(LANG_COOKIE).toBe("saathi.lang");
  });
});
