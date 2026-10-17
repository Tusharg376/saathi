import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState, type ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatEvent } from "@/lib/agent/events";
import { _openForTest, addEntries, listEntries } from "@/lib/db";
import { todayISO } from "@/lib/earnings/dates";
import { clearHandoff } from "@/lib/handoff";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import Home from "./page";
import EarningsPage, { metadata as earningsMeta } from "./earnings/page";
import HelpPage, { metadata as helpMeta } from "./help/page";
import ComplaintPage, { metadata as complaintMeta } from "./help/complaint/page";
import DocumentsPage, { metadata as documentsMeta } from "./help/documents/page";
import RightsPage, { metadata as rightsMeta } from "./rights/page";
import SosPage, { metadata as sosMeta } from "./sos/page";

const { streamChat, fileToJpeg, nav } = vi.hoisted(() => ({
  streamChat: vi.fn(),
  fileToJpeg: vi.fn(),
  nav: { listeners: new Set<(path: string) => void>() },
}));
// A router that moves between the real pages without a server, the way client-side navigation does.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (path: string) => nav.listeners.forEach((go) => go(path)) }),
}));
vi.mock("@/lib/chat/client", () => ({ streamChat }));
vi.mock("@/lib/image/downscale", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image/downscale")>()),
  fileToJpeg,
}));

const ROUTES: Record<string, ComponentType> = {
  "/": Home,
  "/earnings": EarningsPage,
  "/help": HelpPage,
  "/help/complaint": ComplaintPage,
  "/help/documents": DocumentsPage,
  "/rights": RightsPage,
  "/sos": SosPage,
};

/** Shows whichever real page the address names, and follows router.push like the app does. */
function App({ start }: { start: string }) {
  const [path, setPath] = useState(start);
  useEffect(() => {
    nav.listeners.add(setPath);
    return () => void nav.listeners.delete(setPath);
  }, []);
  const Page = ROUTES[path];
  return <Page />;
}

let dbCounter = 0;
beforeEach(() => {
  _openForTest(`flows-${++dbCounter}`);
  streamChat.mockReset();
  fileToJpeg.mockReset().mockResolvedValue({ mimeType: "image/jpeg", data: "BASE64DATA", width: 10, height: 10 });
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  for (const k of ["complaint", "chat", "earnings"] as const) clearHandoff(k);
});
afterEach(() => vi.unstubAllGlobals());

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const text = (t: string): ChatEvent => ({ type: "text", text: t });
const reply = (...events: ChatEvent[]) =>
  streamChat.mockImplementationOnce(async (_req: unknown, onEvent: (e: ChatEvent) => void) => {
    for (const e of events) onEvent(e);
  });
const sheet = () => screen.getByRole("dialog", { name: "Add earnings" });

describe("every address in the app opens the right screen", () => {
  it.each([
    ["/", /e-Shram/, undefined],
    ["/earnings", "Earnings", earningsMeta],
    ["/help", "Papers and complaints", helpMeta],
    ["/help/complaint", "Write a complaint", complaintMeta],
    ["/help/documents", "Understand a paper", documentsMeta],
    ["/rights", "Rights and schemes", rightsMeta],
    ["/sos", "Emergency help", sosMeta],
  ])("%s", async (path, heading, meta) => {
    const { container } = renderUi(<App start={path} />);
    if (typeof heading === "string") {
      expect(
        await screen.findByRole("heading", { level: 1, name: new RegExp(heading.split(" ")[0]) }),
      ).toBeInTheDocument();
    } else {
      expect(await screen.findByRole("button", { name: heading })).toBeInTheDocument();
    }
    if (meta) expect(String(meta.title)).toMatch(/· Saathi$/); // the browser tab names the screen
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("workflows that connect the screens", () => {
  it("earnings warning → complaint, already filled in from the worker's own numbers, and sent nowhere", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await addEntries([
      { date: todayISO(), platform: "Zomato", grossInr: 1000, deductionsInr: 400, fuelInr: 0, otherCostInr: 0 },
    ]);
    renderUi(<App start="/earnings" />);

    await userEvent.click(await screen.findByRole("button", { name: "Write a complaint about this" }));

    expect(await screen.findByRole("heading", { name: "A penalty or cut I think is wrong" })).toBeInTheDocument();
    const said = screen.getByRole("textbox", { name: /tell us what happened/i }) as HTMLTextAreaElement;
    expect(said.value).toContain("Rs 400");
    expect(screen.getByLabelText(/Against whom/)).toHaveValue("Zomato");
    expect(screen.getByLabelText(/Money involved/)).toHaveValue("400");
    expect(fetchMock).not.toHaveBeenCalled(); // nothing is written or sent until the worker asks
  });

  it("chat suggestion → Earnings sheet filled in → worker saves → it is in the history", async () => {
    const entry = {
      date: todayISO(),
      platform: "Swiggy",
      grossInr: 1850,
      deductionsInr: 0,
      fuelInr: 400,
      otherCostInr: 0,
    };
    reply(text("I found it."), { type: "action", action: { kind: "log_earning", entry } }, { type: "done" });
    renderUi(<App start="/" />);
    await userEvent.type(screen.getByRole("textbox"), "aaj Swiggy pe 1850 kamaye");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.click(await screen.findByRole("button", { name: "Check and save" }));

    expect(await screen.findByRole("dialog", { name: "Add earnings" })).toBeInTheDocument();
    expect(within(sheet()).getByLabelText("Earned (Rs)")).toHaveValue("1850");
    expect(await listEntries()).toHaveLength(0); // proposed, not saved

    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));

    await waitFor(async () => expect(await listEntries()).toHaveLength(1));
    expect(await screen.findByText("Recent entries")).toBeInTheDocument();
    expect(screen.getAllByText(/Swiggy/).length).toBeGreaterThan(0);
  });

  it("chat suggestion → complaint with the summary and company filled in", async () => {
    const action = {
      kind: "start_complaint",
      issue: "penalty",
      summary: "Fined Rs 300 with no reason.",
      party: "Zomato",
    } as const;
    reply(text("That seems unfair."), { type: "action", action }, { type: "done" });
    renderUi(<App start="/" />);
    await userEvent.type(screen.getByRole("textbox"), "they fined me for nothing");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.click(await screen.findByRole("button", { name: "Write the complaint" }));

    expect(await screen.findByRole("textbox", { name: /tell us what happened/i })).toHaveValue(
      "Fined Rs 300 with no reason.",
    );
    expect(screen.getByLabelText(/Against whom/)).toHaveValue("Zomato");
  });

  it("photo of a challan → complaint about that challan, with the fine amount", async () => {
    const insight = {
      kind: "challan",
      title: "Traffic challan",
      what_is_this: "A fine of Rs 500 for not wearing a helmet.",
      what_it_wants: "Pay the fine.",
      deadline: "",
      amount: "Rs 500",
      risks: [],
      next_steps: ["Check it on the official site."],
      bring: [],
      scam_signs: false,
      needs_human_help: false,
      confidence: "high",
      related: [],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight })));
    renderUi(<App start="/help/documents" />);
    const picker = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
    await userEvent.upload(picker, new File(["x"], "challan.jpg", { type: "image/jpeg" }));
    await userEvent.click(await screen.findByRole("button", { name: "Write a complaint about this paper" }));

    expect(await screen.findByRole("heading", { name: "Wrong traffic challan" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /tell us what happened/i })).toHaveValue(insight.what_is_this);
    expect(screen.getByLabelText(/Money involved/)).toHaveValue("500");
  });

  it("rights card → chat, with the question already typed for the worker to send or change", async () => {
    renderUi(<App start="/rights" />);
    const card = (await screen.findAllByRole("article"))[0];
    const title = within(card).getByRole("heading", { level: 2 }).textContent;

    await userEvent.click(within(card).getByRole("button", { name: "Ask Saathi about this" }));

    expect(await screen.findByRole("textbox")).toHaveValue(`Tell me about: ${title}`);
    expect(streamChat).not.toHaveBeenCalled(); // typed for them, not sent for them
  });

  it("a complaint card → the complaint form for that kind of problem, not a blank one", async () => {
    renderUi(<App start="/rights" />);
    await userEvent.type(await screen.findByRole("searchbox"), "traffic challan");
    await userEvent.click((await screen.findAllByRole("button", { name: "Write this complaint" }))[0]);

    expect(await screen.findByRole("heading", { name: "Wrong traffic challan" })).toBeInTheDocument();
  });

  it("context is handed over once: coming back to the complaint form later starts blank", async () => {
    await addEntries([
      { date: todayISO(), platform: "Zomato", grossInr: 1000, deductionsInr: 400, fuelInr: 0, otherCostInr: 0 },
    ]);
    const first = renderUi(<App start="/earnings" />);
    await userEvent.click(await screen.findByRole("button", { name: "Write a complaint about this" }));
    await screen.findByRole("heading", { name: "A penalty or cut I think is wrong" });
    first.unmount();

    renderUi(<App start="/help/complaint" />);

    expect(await screen.findByRole("heading", { name: "What is the problem?" })).toBeInTheDocument();
  });
});
