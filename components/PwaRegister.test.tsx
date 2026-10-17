import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PwaRegister } from "./PwaRegister";

/** A phone whose browser supports service workers; `register` is what the test watches. */
function phoneWithServiceWorker(register: () => Promise<unknown>) {
  Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
});

describe("PwaRegister (offline support)", () => {
  it("turns on the offline worker for the whole app in the real, installed version", () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockResolvedValue({});
    phoneWithServiceWorker(register);

    render(<PwaRegister />);

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("stays off while building the app, so a cached copy never hides a code change", () => {
    const register = vi.fn().mockResolvedValue({});
    phoneWithServiceWorker(register);

    render(<PwaRegister />); // tests run as NODE_ENV=test, the same as development here

    expect(register).not.toHaveBeenCalled();
  });

  it("does nothing, and breaks nothing, on a phone whose browser has no service worker", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => render(<PwaRegister />)).not.toThrow();
  });

  it("keeps the app running when the browser refuses the worker, because offline is a bonus", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockRejectedValue(new Error("blocked by browser settings"));
    phoneWithServiceWorker(register);
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    const { container } = render(<PwaRegister />);
    await new Promise((r) => setTimeout(r, 10));
    process.off("unhandledRejection", unhandled);

    expect(register).toHaveBeenCalled();
    expect(unhandled).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });
});
