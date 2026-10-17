import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveContact } from "@/lib/grievance/contact";
import { clearHandoff, setHandoff } from "@/lib/handoff";
import { renderUi } from "@/test/render";
import { ComplaintWizard } from "./ComplaintWizard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const WHAT_HAPPENED = "Zomato cut Rs 300 from my payout on 12 October and gave no reason at all.";
const LETTER = [
  "To the Grievance Officer,",
  "A deduction of Rs 300 was made on 12 October without explanation. Please return it within 7 days.",
  "Sincerely,",
  "{{name}}",
].join("\n");

const draft = (over = {}) => ({
  needsInfo: false,
  questions: [],
  subject: "Wrong deduction",
  letter: LETTER,
  summary: "You are asking Zomato to explain a Rs 300 cut.",
  evidence: ["Screenshot of the payout"],
  ...over,
});
const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
function server(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fetchMock.mockRejectedValueOnce(r);
    else fetchMock.mockResolvedValueOnce(r);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const sent = (fetchMock: ReturnType<typeof vi.fn>, n = 0) =>
  JSON.parse((fetchMock.mock.calls[n][1] as RequestInit).body as string);
const pickIssue = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const describeIt = async (text = WHAT_HAPPENED) =>
  userEvent.type(screen.getByRole("textbox", { name: /tell us what happened/i }), text);
const writeLetter = () => userEvent.click(screen.getByRole("button", { name: "Write my letter" }));
const letterBox = () => screen.findByRole("textbox", { name: /your letter/i });

beforeEach(() => clearHandoff("complaint"));
afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as { clipboard?: unknown }).clipboard;
});

describe("Complaint: what the worker tells us", () => {
  it("goes back to the list of problems, and a different problem can be chosen", async () => {
    renderUi(<ComplaintWizard />);
    await pickIssue("My ID was blocked");
    expect(screen.getByRole("heading", { name: "My ID was blocked" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "What is the problem?" }));
    await pickIssue("Wrong traffic challan");

    expect(screen.getByRole("heading", { name: "Wrong traffic challan" })).toBeInTheDocument();
  });

  it("sends the details the worker filled in, with the amount as a number, so the letter can use them", async () => {
    const fetchMock = server(respond(200, { draft: draft() }));
    renderUi(<ComplaintWizard />);
    await pickIssue("A penalty or cut I think is wrong");
    await describeIt();
    await userEvent.type(screen.getByLabelText(/Against whom/), "Zomato");
    await userEvent.type(screen.getByLabelText(/When\?/), "12 October");
    await userEvent.type(screen.getByLabelText(/Money involved/), "300");
    await userEvent.type(screen.getByLabelText(/Order, trip or ticket/), "ORD-4471");
    await writeLetter();
    await letterBox();

    expect(sent(fetchMock)).toMatchObject({
      issue: "penalty",
      lang: "en",
      letterLang: "en",
      details: { party: "Zomato", dates: "12 October", amountInr: 300, ids: "ORD-4471" },
    });
  });

  it("writes the letter in the worker's language when they choose that, and in English otherwise", async () => {
    const fetchMock = server(respond(200, { draft: draft() }));
    renderUi(<ComplaintWizard />, "hi");
    await userEvent.click(screen.getAllByRole("button")[0]); // the first problem on the list
    expect(screen.getByRole("radio", { name: /अंग्रेज़ी/ })).toBeChecked(); // English works with every office, so it is the default

    await userEvent.click(screen.getByRole("radio", { name: "मेरी भाषा" }));
    await userEvent.type(screen.getByRole("textbox", { name: /क्या हुआ/ }), WHAT_HAPPENED);
    await userEvent.click(screen.getByRole("button", { name: "मेरी चिट्ठी लिखिए" }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(sent(fetchMock)).toMatchObject({ lang: "hi", letterLang: "app" });
  });

  it("shows that it is writing, and cannot be pressed twice meanwhile", async () => {
    let finish: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((r) => (finish = r))));
    renderUi(<ComplaintWizard />);
    await pickIssue("My ID was blocked");
    await describeIt();
    await writeLetter();

    expect(await screen.findByRole("status", { name: "Writing your letter…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Writing your letter…" })).toBeDisabled();

    finish(respond(200, { draft: draft() }));
    await letterBox();
  });

  it("opening it from another screen never sends the worker's text anywhere by itself", () => {
    const fetchMock = server();
    setHandoff("complaint", { issue: "penalty", description: WHAT_HAPPENED, party: "Zomato", amountInr: 300 });
    renderUi(<ComplaintWizard />);
    expect(screen.getByRole("textbox", { name: /tell us what happened/i })).toHaveValue(WHAT_HAPPENED);
    expect(fetchMock).not.toHaveBeenCalled(); // a draft is only ever created when the worker asks for it
  });

  it("clears an earlier complaint message as soon as the worker tries again", async () => {
    server(respond(200, { draft: draft() }));
    renderUi(<ComplaintWizard />);
    await pickIssue("My ID was blocked");
    await describeIt("short");
    await writeLetter();
    expect(await screen.findByRole("alert")).toHaveTextContent("Please write a little more.");

    await userEvent.type(
      screen.getByRole("textbox", { name: /tell us what happened/i }),
      " and more words follow here.",
    );
    await writeLetter();

    await letterBox();
    expect(screen.queryByText("Please write a little more.")).not.toBeInTheDocument();
  });
});

describe("Complaint: the worker's own details", () => {
  it("are filled in from last time, and go into the letter on the phone without being sent to the server", async () => {
    saveContact({ name: "Sunita Devi", phone: "9123456780", city: "Patna" });
    const fetchMock = server(respond(200, { draft: draft({ letter: LETTER + "\nPhone: {{phone}}\n{{city}}" }) }));
    renderUi(<ComplaintWizard />);
    await pickIssue("My ID was blocked");

    expect(screen.getByLabelText("Your name")).toHaveValue("Sunita Devi");
    expect(screen.getByLabelText("Your phone")).toHaveValue("9123456780");
    expect(screen.getByLabelText("Your city")).toHaveValue("Patna");

    await describeIt();
    await writeLetter();
    const letter = (await letterBox()) as HTMLTextAreaElement;

    expect(letter.value).toContain("Sunita Devi");
    expect(letter.value).toContain("9123456780");
    const wire = JSON.stringify(sent(fetchMock));
    expect(wire).not.toContain("Sunita Devi");
    expect(wire).not.toContain("9123456780");
    expect(sent(fetchMock).details.city).toBe("Patna"); // only the city, which helps pick the right office
  });
});

describe("Complaint: the follow-up questions", () => {
  const ask = () =>
    respond(200, { draft: draft({ needsInfo: true, questions: ["Which order?", "What date?"], letter: "" }) });

  it("keeps every answer typed so far, and each answer goes with its own question", async () => {
    const fetchMock = server(ask(), respond(200, { draft: draft() }));
    renderUi(<ComplaintWizard />);
    await pickIssue("A penalty or cut I think is wrong");
    await describeIt();
    await writeLetter();

    await userEvent.type(await screen.findByLabelText("Which order?"), "4471");
    await userEvent.type(screen.getByLabelText("What date?"), "12 Oct");
    expect(screen.getByLabelText("Which order?")).toHaveValue("4471"); // typing in the second box did not disturb the first
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await letterBox();

    expect(sent(fetchMock, 1).answers).toEqual([
      { q: "Which order?", a: "4471" },
      { q: "What date?", a: "12 Oct" },
    ]);
  });

  it("asks the worker to wait if the second request is refused, keeping their answers so nothing is retyped", async () => {
    server(ask(), respond(429, { error: "rate_limited" }), respond(200, { draft: draft() }));
    renderUi(<ComplaintWizard />);
    await pickIssue("A penalty or cut I think is wrong");
    await describeIt();
    await writeLetter();
    await userEvent.type(await screen.findByLabelText("Which order?"), "4471");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries");
    expect(screen.getByLabelText("Which order?")).toHaveValue("4471");

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await letterBox();
  });

  it("shows that it is writing while the second request runs", async () => {
    let finish: (r: Response) => void = () => {};
    const fetchMock = server(ask());
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (finish = r)));
    renderUi(<ComplaintWizard />);
    await pickIssue("A penalty or cut I think is wrong");
    await describeIt();
    await writeLetter();
    await userEvent.click(await screen.findByRole("button", { name: "Skip and write it" }));

    expect(await screen.findByRole("status", { name: "Writing your letter…" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip and write it" })).toBeDisabled();
    finish(respond(200, { draft: draft() }));
    await letterBox();
  });
});

describe("Complaint: the finished letter", () => {
  async function finishedLetter(over = {}) {
    server(respond(200, { draft: draft(over) }));
    renderUi(<ComplaintWizard />);
    await pickIssue("A penalty or cut I think is wrong");
    await describeIt();
    await writeLetter();
    return letterBox();
  }

  it("warns about blanks the worker still has to fill, and the warning goes away once they do", async () => {
    const box = await finishedLetter({ letter: LETTER + "\nOrder number: [ADD: your order number]" });
    const warning = screen.getByRole("alert");
    expect(warning).toHaveTextContent("Fill these before sending:");
    expect(within(warning).getByText("[ADD: your order number]")).toBeInTheDocument();

    await userEvent.clear(box);
    await userEvent.type(box, "A complete letter with nothing left to fill in.");

    expect(screen.queryByText("Fill these before sending:")).not.toBeInTheDocument();
  });

  it("copies the letter exactly as the worker edited it, not the first draft", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => void written.push(text) },
    });
    const box = await finishedLetter();
    await userEvent.clear(box);
    await userEvent.type(box, "My own corrected words.");

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(written).toEqual(["My own corrected words."]);
  });

  it("lists what to collect, and the next offices to try if no one replies, with a number to call", async () => {
    await finishedLetter({ evidence: ["Screenshot of the payout", "Order numbers"] });

    expect(screen.getByRole("checkbox", { name: "Screenshot of the payout" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Order numbers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "If no one replies, go step by step" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(2);
  });

  it("falls back to the standard list of papers to collect when the AI suggested none", async () => {
    await finishedLetter({ evidence: [] });
    expect(screen.getByRole("heading", { name: "Collect these before you send" })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").length).toBeGreaterThan(0);
  });

  it("keeps the printed page to just the letter, and hides the screen-only helpers from print", async () => {
    await finishedLetter();
    const printed = document.querySelector("pre");
    expect(printed).toHaveClass("hidden", "print:block");
    expect(printed).toHaveTextContent("A deduction of Rs 300");
    expect(screen.getByRole("heading", { name: "Collect these before you send" }).closest("section")).toHaveClass(
      "print:hidden",
    );
  });

  it("starting over forgets the old problem and the old words", async () => {
    await finishedLetter();
    await userEvent.click(screen.getByRole("button", { name: "Start over" }));
    await pickIssue("A penalty or cut I think is wrong");
    expect(screen.getByRole("textbox", { name: /tell us what happened/i })).toHaveValue("");
  });
});
