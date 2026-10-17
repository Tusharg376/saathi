// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { readContact, saveContact, sanitizeContact } from "./contact";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the worker's own contact details", () => {
  it("are remembered on this phone so they are typed once", () => {
    saveContact({ name: "Raju Kumar", phone: "9876543210", city: "Patna" });
    expect(readContact()).toEqual({ name: "Raju Kumar", phone: "9876543210", city: "Patna" });
  });

  it("start empty on a new phone", () => {
    expect(readContact()).toEqual({ name: "", phone: "", city: "" });
  });

  it("survive a damaged saved value by starting empty instead of crashing the complaint screen", () => {
    localStorage.setItem("saathi.contact", "{not json");
    expect(readContact()).toEqual({ name: "", phone: "", city: "" });
  });

  it("keep only the three fields, as text of a sensible length", () => {
    const clean = sanitizeContact({ name: "N".repeat(500), phone: 9876543210, city: ["Patna"], secret: "x" });
    expect(clean).toEqual({ name: "N".repeat(80), phone: "", city: "" });
  });

  it("do not stop the letter from working when the phone blocks saving", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(() => saveContact({ name: "Raju", phone: "1", city: "Patna" })).not.toThrow();
  });

  it("are never sent anywhere when saved or read", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    saveContact({ name: "Raju", phone: "9876543210", city: "Patna" });
    readContact();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
