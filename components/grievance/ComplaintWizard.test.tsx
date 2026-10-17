import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readContact } from "@/lib/grievance/contact";
import { clearHandoff, setHandoff } from "@/lib/handoff";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { ComplaintWizard } from "./ComplaintWizard";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const WHAT_HAPPENED = "Zomato cut Rs 300 from my payout on 12 October and gave no reason at all.";

const LONG_LETTER = [
  "To the Grievance Officer,",
  "I am writing about a deduction of Rs 300 made on 12 October without any explanation.",
  "Please explain it and return the money within 7 days. I can share the order screenshots.",
  "Sincerely,",
  "{{name}}",
  "Phone: {{phone}}",
].join("\n");

const draft = (over = {}) => ({
  needsInfo: false,
  questions: [],
  subject: "Wrong deduction",
  letter: LONG_LETTER,
  summary: "You are asking Zomato to explain a Rs 300 cut and give it back.",
  evidence: ["Screenshot of the payout"],
  ...over,
});

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/** Replace the network. Each call to the server gets the next response in turn. */
function server(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) fetchMock.mockRejectedValueOnce(r);
    else fetchMock.mockResolvedValueOnce(r);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const bodyOfCall = (fetchMock: ReturnType<typeof vi.fn>, n = 0) =>
  JSON.parse((fetchMock.mock.calls[n][1] as RequestInit).body as string);

const pickIssue = (name: string) => userEvent.click(screen.getByRole("button", { name }));
const describe_ = async (text = WHAT_HAPPENED) => {
  const box = screen.getByRole("textbox", { name: /tell us what happened/i });
  await userEvent.clear(box);
  await userEvent.type(box, text);
};
const valueOf = (el: HTMLElement) => (el as HTMLTextAreaElement).value;
const writeLetter = () => userEvent.click(screen.getByRole("button", { name: "Write my letter" }));

beforeEach(() => {
  push.mockReset();
  clearHandoff("complaint");
});
afterEach(() => vi.unstubAllGlobals());

describe("ComplaintWizard: the main path", () => {
  it("goes from the problem, to what happened, to a letter the worker can read and edit", async () => {
    server(respond(200, { draft: draft() }));
    renderUi(<ComplaintWizard />);

    await pickIssue("A penalty or cut I think is wrong");
    await describe_();
    await writeLetter();

    const letter = await screen.findByRole("textbox", { name: /your letter/i });
    expect(valueOf(letter)).toContain("deduction of Rs 300");
    expect(screen.getByText("What this letter says")).toBeInTheDocument();
    expect(screen.getByText(/asking Zomato to explain/)).toBeInTheDocument();

    await userEvent.type(letter, " EXTRA LINE");
    expect(valueOf(letter)).toContain("EXTRA LINE");
  });

  it("fills the worker's own details into the letter on the phone, and never sends them to the server", async () => {
    const fetchMock = server(respond(200, { draft: draft() }));
    renderUi(<ComplaintWizard />);

    await pickIssue("A penalty or cut I think is wrong");
    await describe_();
    await userEvent.type(screen.getByLabelText("Your name"), "Raju Kumar");
    await userEvent.type(screen.getByLabelText("Your phone"), "9876543210");
    await writeLetter();

    const letter = await screen.findByRole("textbox", { name: /your letter/i });
    expect(valueOf(letter)).toContain("Raju Kumar");
    expect(valueOf(letter)).toContain("9876543210");

    const sent = JSON.stringify(bodyOfCall(fetchMock));
    expect(sent).not.toContain("Raju Kumar");
    expect(sent).not.toContain("9876543210");
  });

  it("remembers the worker's contact details on this device only", async () => {
    server(respond(200, { draft: draft() }));
    renderUi(<ComplaintWizard />);
    await pickIssue("My ID was blocked");
    await userEvent.type(screen.getByLabelText("Your name"), "Sunita Devi");
    expect(readContact().name).toBe("Sunita Devi");
  });

  it("asks for a little more when the description is too short, without calling the server", async () => {
    const fetchMock = server();
    renderUi(<ComplaintWizard />);
    await pickIssue("My ID was blocked");
    await describe_("blocked");
    await writeLetter();
    expect(await screen.findByRole("alert")).toHaveTextContent("Please write a little more.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("start over goes back to the first question", async () => {
    server(respond(200, { draft: draft() }));
    renderUi(<ComplaintWizard />);
    await pickIssue("My ID was blocked");
    await describe_();
    await writeLetter();
    await userEvent.click(await screen.findByRole("button", { name: "Start over" }));
    expect(screen.getByText("What is the problem?")).toBeInTheDocument();
  });
});

describe("ComplaintWizard: the follow-up questions", () => {
  const ask = () => respond(200, { draft: draft({ needsInfo: true, questions: ["Which order was it?"], letter: "" }) });

  it("asks what is missing, and sends the answers with the final request", async () => {
    const fetchMock = server(ask(), respond(200, { draft: draft() }));
    renderUi(<ComplaintWizard />);
    await pickIssue("A penalty or cut I think is wrong");
    await describe_();
    await writeLetter();

    await userEvent.type(await screen.findByLabelText("Which order was it?"), "Order 4471");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("textbox", { name: /your letter/i });

    const second = bodyOfCall(fetchMock, 1);
    expect(second.final).toBe(true);
    expect(second.answers).toEqual([{ q: "Which order was it?", a: "Order 4471" }]);
  });

  it("lets the worker skip the questions and still get a letter", async () => {
    const fetchMock = server(ask(), respond(200, { draft: draft() }));
    renderUi(<ComplaintWizard />);
    await pickIssue("A penalty or cut I think is wrong");
    await describe_();
    await writeLetter();
    await userEvent.click(await screen.findByRole("button", { name: "Skip and write it" }));
    await screen.findByRole("textbox", { name: /your letter/i });
    expect(bodyOfCall(fetchMock, 1).answers).toBeUndefined();
  });
});

describe("ComplaintWizard: when the AI cannot help", () => {
  it("offline: still gives a standard letter, built from the worker's own words, and says so", async () => {
    server(new TypeError("Failed to fetch"));
    renderUi(<ComplaintWizard />);
    await pickIssue("A penalty or cut I think is wrong");
    await describe_();
    await writeLetter();

    expect(await screen.findByText(/The AI could not write this/)).toBeInTheDocument();
    expect(valueOf(screen.getByRole("textbox", { name: /your letter/i }))).toContain(WHAT_HAPPENED);
  });

  it("no API key: gives the standard letter and says AI is not switched on", async () => {
    server(respond(503, { error: "no_key" }));
    renderUi(<ComplaintWizard />);
    await pickIssue("My ID was blocked");
    await describe_();
    await writeLetter();
    expect(await screen.findByText(/AI is not switched on/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /your letter/i })).toBeInTheDocument();
  });

  it("rate limited: asks the worker to wait and keeps what they wrote", async () => {
    server(respond(429, { error: "rate_limited" }));
    renderUi(<ComplaintWizard />);
    await pickIssue("My ID was blocked");
    await describe_();
    await writeLetter();
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries");
    expect(screen.getByRole("textbox", { name: /tell us what happened/i })).toHaveValue(WHAT_HAPPENED);
  });
});

describe("ComplaintWizard: arriving from another screen", () => {
  it("opens on the details step with the problem, summary and company already filled in", () => {
    setHandoff("complaint", { issue: "penalty", description: WHAT_HAPPENED, party: "Zomato", amountInr: 300 });
    renderUi(<ComplaintWizard />);

    expect(screen.queryByText("What is the problem?")).toBeInTheDocument(); // the back link
    expect(screen.getByRole("heading", { name: "A penalty or cut I think is wrong" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /tell us what happened/i })).toHaveValue(WHAT_HAPPENED);
    expect(screen.getByLabelText(/against whom/i)).toHaveValue("Zomato");
    expect(screen.getByLabelText(/money involved/i)).toHaveValue("300");
  });

  it("starts at the first question when nothing was handed over", () => {
    renderUi(<ComplaintWizard />);
    expect(screen.getByRole("heading", { name: "What is the problem?" })).toBeInTheDocument();
  });
});

describe("ComplaintWizard: language", () => {
  it("offers a choice of letter language only when the app is not in English", async () => {
    const { unmount } = renderUi(<ComplaintWizard />, "en");
    await pickIssue("My ID was blocked");
    expect(screen.queryByRole("group", { name: /letter language/i })).not.toBeInTheDocument();
    unmount();

    renderUi(<ComplaintWizard />, "hi");
    await userEvent.click(screen.getAllByRole("button")[0]);
    expect(await screen.findByRole("group", { name: "चिट्ठी की भाषा" })).toBeInTheDocument();
  });
});

describe("ComplaintWizard: accessibility", () => {
  it("has no violations on any step", async () => {
    server(respond(200, { draft: draft() }));
    const { container } = renderUi(<ComplaintWizard />);
    expect(await axe(container)).toHaveNoViolations();

    await pickIssue("A penalty or cut I think is wrong");
    expect(await axe(container)).toHaveNoViolations();

    await describe_();
    await writeLetter();
    await screen.findByRole("textbox", { name: /your letter/i });
    expect(await axe(container)).toHaveNoViolations();
  });
});
