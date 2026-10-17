import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LANGUAGES } from "@/lib/i18n/languages";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { AppShell } from "./AppShell";

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/" } }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current, useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => {
  pathname.current = "/";
});

const nav = () => screen.getByRole("navigation", { name: "Main" });

describe("AppShell: getting around", () => {
  it("has a tab for each part of the app, each going where its name says", () => {
    renderUi(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );
    const hrefs = within(nav())
      .getAllByRole("link")
      .map((a) => [a.textContent, a.getAttribute("href")]);
    expect(hrefs).toEqual([
      ["Saathi", "/"],
      ["Earnings", "/earnings"],
      ["Rights", "/rights"],
      ["Help", "/help"],
    ]);
  });

  it("marks the tab you are on", () => {
    pathname.current = "/rights";
    renderUi(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );
    expect(within(nav()).getByRole("link", { name: "Rights" })).toHaveAttribute("aria-current", "page");
    expect(within(nav()).getByRole("link", { name: "Saathi" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the Help tab lit on a page inside Help", () => {
    pathname.current = "/help/complaint";
    renderUi(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );
    expect(within(nav()).getByRole("link", { name: "Help" })).toHaveAttribute("aria-current", "page");
  });

  it("always shows the SOS link, on every page", () => {
    renderUi(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: "SOS" })).toHaveAttribute("href", "/sos");
  });

  it("shows the page inside", () => {
    renderUi(
      <AppShell>
        <p>the page</p>
      </AppShell>,
    );
    expect(within(screen.getByRole("main")).getByText("the page")).toBeInTheDocument();
  });
});

describe("AppShell: language and screen settings", () => {
  const shell = () =>
    renderUi(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );

  it("changes the whole app to the language the worker picks, and remembers it on this phone", async () => {
    shell();
    await userEvent.click(screen.getByRole("button", { name: /^Choose language/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "हिन्दी" }));

    expect(within(nav()).getByRole("link", { name: "कमाई" })).toBeInTheDocument();
    expect(localStorage.getItem("saathi.lang")).toBe("hi");
    expect(document.documentElement.lang).toBe("hi");
  });

  it('names the language button after the language it shows, so voice control ("click English") finds it', () => {
    shell();
    expect(screen.getByRole("button", { name: "Choose language: English" })).toHaveTextContent("English");
  });

  it("offers every language the app is translated into", async () => {
    shell();
    await userEvent.click(screen.getByRole("button", { name: /^Choose language/ }));
    const dialog = within(screen.getByRole("dialog"));
    for (const { native } of LANGUAGES) expect(dialog.getByRole("button", { name: native })).toBeInTheDocument();
  });

  it("switches on large text and keeps it", async () => {
    shell();
    await userEvent.click(screen.getByRole("button", { name: /^Choose language/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("switch", { name: "Large text" }));
    expect(localStorage.getItem("saathi.pref.largeText")).toBe("1");
  });

  it("switches on reading answers aloud and keeps it", async () => {
    shell();
    await userEvent.click(screen.getByRole("button", { name: /^Choose language/ }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("switch", { name: "Read answers aloud" }));
    expect(localStorage.getItem("saathi.pref.autoRead")).toBe("1");
  });
});

describe("AppShell: a language whose screens are not translated yet", () => {
  const openLanguages = async () => {
    renderUi(
      <AppShell>
        <p>page</p>
      </AppShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: /^Choose language/ }));
    return within(screen.getByRole("dialog"));
  };

  it("says so, instead of looking broken, when the worker picks one", async () => {
    const dialog = await openLanguages();
    expect(dialog.queryByText(/screens are still in English/)).not.toBeInTheDocument(); // English is complete
    await userEvent.click(dialog.getByRole("button", { name: "தமிழ்" }));
    expect(await dialog.findByText(/screens are still in English/)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("open"); // left open, so the note is actually seen
  });

  it("closes the sheet by itself when the language is complete", async () => {
    const dialog = await openLanguages();
    await userEvent.click(dialog.getByRole("button", { name: "हिन्दी" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); // closed dialogs are not in the accessibility tree
  });

  it("does not say it for English or Hindi, which are complete", async () => {
    const dialog = await openLanguages();
    await userEvent.click(dialog.getByRole("button", { name: "हिन्दी" }));
    expect(dialog.queryByText(/स्क्रीन अभी अंग्रेज़ी में हैं/)).not.toBeInTheDocument();
    expect(dialog.queryByText(/screens are still in English/)).not.toBeInTheDocument();
  });
});

describe("AppShell: accessibility", () => {
  it("has no violations", async () => {
    const { container } = renderUi(
      <AppShell>
        <h1>Page</h1>
      </AppShell>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
