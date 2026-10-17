import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, useI18n } from "./provider";

/** Shows what the provider decided, and lets the test switch language like the language picker does. */
function Probe() {
  const { lang, t, speechLang, setLang } = useI18n();
  return (
    <>
      <p data-testid="lang">{lang}</p>
      <p data-testid="speech">{speechLang}</p>
      <p data-testid="word">{t("cmp.copy")}</p>
      <button onClick={() => setLang("hi")}>choose Hindi</button>
    </>
  );
}

const lang = () => screen.getByTestId("lang").textContent;
const show = (serverLang?: "hi" | "en" | "ta" | "bn") =>
  render(
    <I18nProvider serverLang={serverLang}>
      <Probe />
    </I18nProvider>,
  );
const cookie = () => document.cookie.split("; ").find((c) => c.startsWith("saathi.lang="));
const browserLanguages = (list: string[]) => vi.spyOn(navigator, "languages", "get").mockReturnValue(list);
const blockStorage = (...methods: ("getItem" | "setItem")[]) =>
  methods.forEach((m) =>
    vi.spyOn(Storage.prototype, m).mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    }),
  );

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.lang = "";
  document.cookie = "saathi.lang=; path=/; max-age=0";
});

describe("I18nProvider: choosing the language", () => {
  it("uses the language the worker picked last time, even if the phone is set to another", () => {
    localStorage.setItem("saathi.lang", "bn");
    browserLanguages(["ta-IN", "en"]);
    show();
    expect(lang()).toBe("bn");
  });

  it("with nothing saved, follows the phone's own language list in order, skipping ones the app lacks", () => {
    browserLanguages(["fr-FR", "te-IN", "en-US"]);
    show();
    expect(lang()).toBe("te");
    expect(screen.getByTestId("speech")).toHaveTextContent("te-IN");
  });

  it("falls back to Hindi when the phone's languages are not ones the app offers", () => {
    browserLanguages(["fr-FR", "de"]);
    show();
    expect(lang()).toBe("hi");
  });

  it("ignores a saved value that is not a language it knows, instead of showing raw keys", () => {
    localStorage.setItem("saathi.lang", "klingon");
    browserLanguages(["gu-IN"]);
    show();
    expect(lang()).toBe("gu");
    expect(screen.getByTestId("word")).not.toHaveTextContent("cmp.copy"); // a real word, never the raw key
  });

  it("still works when the phone blocks reading saved settings (private mode)", () => {
    blockStorage("getItem");
    browserLanguages(["kn-IN"]);
    show();
    expect(lang()).toBe("kn");
  });
});

describe("I18nProvider: switching language", () => {
  it("changes every word on screen, remembers the choice, and marks the page's language for screen readers", async () => {
    browserLanguages(["en-US"]);
    show();
    expect(screen.getByTestId("word")).toHaveTextContent("Copy");
    expect(document.documentElement.lang).toBe("en");

    await userEvent.click(screen.getByRole("button", { name: "choose Hindi" }));

    expect(lang()).toBe("hi");
    expect(screen.getByTestId("speech")).toHaveTextContent("hi-IN");
    expect(screen.getByTestId("word")).toHaveTextContent("कॉपी करें");
    expect(localStorage.getItem("saathi.lang")).toBe("hi");
    expect(document.documentElement.lang).toBe("hi");
  });

  it("still switches for this visit when the phone will not let the app remember the choice", async () => {
    blockStorage("setItem");
    browserLanguages(["en-US"]);
    show();
    await userEvent.click(screen.getByRole("button", { name: "choose Hindi" }));
    expect(lang()).toBe("hi");
  });
});

describe("I18nProvider: agreeing with the server", () => {
  it("starts in the language the server wrote the page in, so nothing flashes or jumps", () => {
    browserLanguages(["en-US"]);
    const seen: string[] = [];
    function Recorder() {
      seen.push(useI18n().lang);
      return null;
    }
    render(
      <I18nProvider serverLang="ta">
        <Recorder />
      </I18nProvider>,
    );
    expect(seen[0]).toBe("ta"); // the first thing drawn already matches the server's page
    expect(new Set(seen)).toEqual(new Set(["ta"])); // and it never passes through Hindi on the way
  });

  it("still lets a choice saved on this phone win over the server's guess", () => {
    localStorage.setItem("saathi.lang", "bn");
    show("ta");
    expect(lang()).toBe("bn");
  });

  it("tells the server about a choice made on an older visit, so the next page already arrives in it", () => {
    localStorage.setItem("saathi.lang", "bn");
    show("ta");
    expect(cookie()).toBe("saathi.lang=bn");
  });

  it("tells the server whenever the worker picks a language", async () => {
    browserLanguages(["en-US"]);
    show();
    await userEvent.click(screen.getByRole("button", { name: "choose Hindi" }));
    expect(cookie()).toBe("saathi.lang=hi");
  });

  it("keeps the cookie for a year, for this site only, and never sends it to other sites", async () => {
    const written: string[] = [];
    const real = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;
    vi.spyOn(document, "cookie", "set").mockImplementation((v: string) => {
      written.push(v);
      real.set!.call(document, v);
    });
    browserLanguages(["en-US"]);
    show();
    await userEvent.click(screen.getByRole("button", { name: "choose Hindi" }));
    expect(written.at(-1)).toMatch(/^saathi\.lang=hi; path=\/; max-age=31536000; samesite=lax/);
  });

  it("does not remember a choice for the server before the worker has made one", () => {
    browserLanguages(["ta-IN"]);
    show();
    expect(cookie()).toBeUndefined(); // a guess from the phone's settings is not a choice
  });
});

describe("useI18n", () => {
  it("fails loudly with a clear message if a screen is built outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow("useI18n must be used inside <I18nProvider>");
  });

  it("translates with the placeholders filled in", () => {
    function Greeting() {
      const { t } = useI18n();
      return <p>{t("earn.up", { pct: 12 })}</p>;
    }
    browserLanguages(["en-US"]);
    act(() => {
      render(
        <I18nProvider>
          <Greeting />
        </I18nProvider>,
      );
    });
    expect(screen.getByText(/12%/)).toBeInTheDocument();
  });
});
