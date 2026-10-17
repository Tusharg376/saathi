import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { ShareActions } from "./ShareActions";

const LETTER = "Dear Sir,\nZomato kept Rs 400 from my payout on 14 October. Please check and return it.\nThank you.";
const SUBJECT = "Complaint: payout deduction";

/** A phone whose clipboard works (or refuses), plus spies for the other apps the buttons hand over to. */
function phone({ clipboard = "works" as "works" | "refuses" | "missing" } = {}) {
  const written: string[] = [];
  if (clipboard !== "missing") {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          if (clipboard === "refuses") throw new DOMException("no permission", "NotAllowedError");
          written.push(text);
        },
      },
    });
  }
  const open = vi.fn();
  const print = vi.fn();
  vi.stubGlobal("open", open);
  vi.stubGlobal("print", print);
  vi.stubGlobal("location", { href: "http://localhost/help/complaint" });
  return { written, open, print };
}

beforeEach(() => {
  // No way to copy through the old route either, unless a test says otherwise.
  document.execCommand = vi.fn().mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete (navigator as { clipboard?: unknown }).clipboard;
  delete (document as { execCommand?: unknown }).execCommand;
});

describe("ShareActions: taking the finished letter out of the app", () => {
  it("copies the whole letter and says so, then goes back to saying Copy", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { written } = phone();
    renderUi(<ShareActions letter={LETTER} subject={SUBJECT} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(written).toEqual([LETTER]);

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("does not claim it copied when the phone refused every way of copying", async () => {
    phone({ clipboard: "refuses" });
    renderUi(<ShareActions letter={LETTER} subject={SUBJECT} />);

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("opens WhatsApp with the letter ready, in a new tab, without choosing who receives it", async () => {
    const { open } = phone();
    renderUi(<ShareActions letter={LETTER} subject={SUBJECT} />);

    await userEvent.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(open).toHaveBeenCalledTimes(1);
    const [url, target, features] = open.mock.calls[0];
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/); // no phone number: the worker picks the chat
    expect(decodeURIComponent(String(url).split("text=")[1])).toBe(LETTER);
    expect(target).toBe("_blank");
    expect(features).toBe("noopener"); // the other site gets no handle back to Saathi
  });

  it("opens the email app with the subject and letter filled in, and sends nothing itself", async () => {
    const { written } = phone();
    renderUi(<ShareActions letter={LETTER} subject={SUBJECT} />);

    await userEvent.click(screen.getByRole("button", { name: "Email" }));

    const href = location.href;
    expect(href.startsWith("mailto:?")).toBe(true);
    expect(decodeURIComponent(href.split("subject=")[1].split("&")[0])).toBe(SUBJECT);
    expect(decodeURIComponent(href.split("body=")[1])).toBe(LETTER);
    expect(written).toEqual([]); // it fit in the link, so the clipboard is left alone
    expect(screen.queryByRole("button", { name: "Copied" })).not.toBeInTheDocument();
  });

  it("puts a letter too long for an email link on the clipboard instead of cutting it short", async () => {
    const longLetter = "I was not paid for the trips on these dates and I have kept the screenshots. ".repeat(40);
    const { written } = phone();
    renderUi(<ShareActions letter={longLetter} subject={SUBJECT} />);

    await userEvent.click(screen.getByRole("button", { name: "Email" }));

    expect(written).toEqual([longLetter]); // the full text, ready to paste
    expect(location.href).toContain("subject=");
    expect(location.href).not.toContain("body="); // never a silently truncated letter
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("opens the print dialog so the letter can be saved as a PDF or printed at a shop", async () => {
    const { print } = phone();
    renderUi(<ShareActions letter={LETTER} subject={SUBJECT} />);

    await userEvent.click(screen.getByRole("button", { name: "Print or save PDF" }));

    expect(print).toHaveBeenCalledTimes(1);
  });

  it("offers every choice in the worker's own language", async () => {
    phone();
    renderUi(<ShareActions letter={LETTER} subject={SUBJECT} />, "hi");
    expect(screen.getByRole("button", { name: "कॉपी करें" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ईमेल" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    phone();
    const { container } = renderUi(<ShareActions letter={LETTER} subject={SUBJECT} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
