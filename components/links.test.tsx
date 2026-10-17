import { existsSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HANDOFF_ROUTE } from "@/lib/useHandoffNav";
import { I18nProvider } from "@/lib/i18n/provider";
import { AppShell } from "./AppShell";
import { EmergencyBanner } from "./EmergencyBanner";
import { SosPanel } from "./SosPanel";
import { Welcome } from "./Welcome";
import { HelpHub } from "./help/HelpHub";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

const APP = path.join(import.meta.dirname, "..", "app");

/** Does the app have a page at this address? "/" is app/page.tsx, "/help" is app/help/page.tsx. */
const pageExists = (href: string) => existsSync(path.join(APP, href === "/" ? "" : href, "page.tsx"));

/** Every address a screen links to inside the app. */
function internalLinks(ui: React.ReactElement): string[] {
  const { container, unmount } = render(<I18nProvider>{ui}</I18nProvider>);
  const hrefs = [...container.querySelectorAll("a[href^='/']")].map((a) => a.getAttribute("href")!);
  unmount();
  return hrefs;
}

describe("no dead links", () => {
  const screens: [string, React.ReactElement][] = [
    [
      "the app shell",
      <AppShell key="s">
        <p>x</p>
      </AppShell>,
    ],
    ["the welcome screen", <Welcome key="w" onAsk={() => undefined} />],
    ["the help hub", <HelpHub key="h" />],
    ["the SOS screen", <SosPanel key="o" />],
    ["an emergency banner", <EmergencyBanner key="e" severity="urgent" helplines={["police"]} />],
  ];

  for (const [name, ui] of screens) {
    it(`every link on ${name} goes to a page that exists`, () => {
      const links = internalLinks(ui);
      for (const href of links) expect(pageExists(href), `${href} has no page`).toBe(true);
    });
  }

  it("every place one screen hands the worker to another exists", () => {
    for (const [target, href] of Object.entries(HANDOFF_ROUTE)) {
      expect(pageExists(href), `${target} -> ${href} has no page`).toBe(true);
    }
  });
});
