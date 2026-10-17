import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _openForTest, addEntries, listEntries } from "@/lib/db";
import { todayISO } from "@/lib/earnings/dates";
import { clearHandoff, peekHandoff, setHandoff } from "@/lib/handoff";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { EarningsView } from "./EarningsView";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

let dbCounter = 0;
beforeEach(() => {
  _openForTest(`earnings-view-${++dbCounter}`); // a fresh on-device database for every test
  push.mockReset();
  clearHandoff("earnings");
  clearHandoff("complaint");
});
afterEach(() => vi.unstubAllGlobals());

const today = () => todayISO();
const entry = (over = {}) => ({
  date: today(),
  platform: "Swiggy",
  grossInr: 1850,
  deductionsInr: 0,
  fuelInr: 400,
  otherCostInr: 0,
  ...over,
});

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const openSheet = () => userEvent.click(screen.getByRole("button", { name: "Add earnings" }));
const sheet = () => screen.getByRole("dialog", { name: "Add earnings" });

describe("EarningsView: empty and first entry", () => {
  it("invites the worker to add the first day instead of showing zeros", async () => {
    renderUi(<EarningsView />);
    expect(await screen.findByText(/No earnings yet/)).toBeInTheDocument();
    expect(screen.queryByText("Last 7 days")).not.toBeInTheDocument();
  });

  it("saves an entry typed by hand to this phone, and the screen updates", async () => {
    renderUi(<EarningsView />);
    await screen.findByText(/No earnings yet/);
    await openSheet();

    await userEvent.type(within(sheet()).getByLabelText("App or work"), "Swiggy");
    await userEvent.type(within(sheet()).getByLabelText("Earned (Rs)"), "1850");
    await userEvent.type(within(sheet()).getByLabelText("Fuel (Rs)"), "400");
    expect(within(sheet()).getByText("Net: ₹1,450")).toBeInTheDocument(); // the live preview

    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Recent entries")).toBeInTheDocument();
    const saved = await listEntries();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ platform: "Swiggy", grossInr: 1850, fuelInr: 400, date: today() });
  });

  it("refuses to save an empty form and says why, saving nothing", async () => {
    renderUi(<EarningsView />);
    await screen.findByText(/No earnings yet/);
    await openSheet();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));

    expect(await within(sheet()).findByText("Add at least one amount.")).toBeInTheDocument();
    expect(screen.queryByText("This browser cannot save on your phone.")).not.toBeInTheDocument();
    expect(await listEntries()).toHaveLength(0);
  });

  it("does not accept something that is not a number as if it were zero", async () => {
    renderUi(<EarningsView />);
    await screen.findByText(/No earnings yet/);
    await openSheet();
    await userEvent.type(within(sheet()).getByLabelText("Earned (Rs)"), "abc");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));
    expect(await within(sheet()).findByText("Use numbers only.")).toBeInTheDocument();
    expect(await listEntries()).toHaveLength(0);
  });
});

describe("EarningsView: describing earnings in words", () => {
  it("fills the form from what the worker said, and saves nothing until they confirm", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { entries: [entry({ orders: 12 })], confidence: "high" }));
    vi.stubGlobal("fetch", fetchMock);
    renderUi(<EarningsView />);
    await screen.findByText(/No earnings yet/);
    await openSheet();

    await userEvent.type(
      within(sheet()).getByLabelText("Say or type it"),
      "aaj Swiggy pe 12 order, 1850 rupaye, petrol 400",
    );
    await userEvent.click(within(sheet()).getByRole("button", { name: "Fill the form for me" }));

    await waitFor(() => expect(within(sheet()).getByLabelText("Earned (Rs)")).toHaveValue("1850"));
    expect(within(sheet()).getByLabelText("Orders or trips")).toHaveValue("12");
    expect(await listEntries()).toHaveLength(0); // the worker has not confirmed yet
    expect(fetchMock).toHaveBeenCalledWith("/api/earnings/parse", expect.anything());
  });

  it("offline: tells the worker to fill the form by hand, which still works", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderUi(<EarningsView />);
    await screen.findByText(/No earnings yet/);
    await openSheet();
    await userEvent.type(within(sheet()).getByLabelText("Say or type it"), "today 1200");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Fill the form for me" }));
    expect(await within(sheet()).findByText("Could not read that. Fill the form by hand.")).toBeInTheDocument();

    await userEvent.type(within(sheet()).getByLabelText("Earned (Rs)"), "1200");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));
    await waitFor(async () => expect(await listEntries()).toHaveLength(1));
  });

  it("no API key: says reading by AI is not switched on", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(503, { error: "no_key" })));
    renderUi(<EarningsView />);
    await screen.findByText(/No earnings yet/);
    await openSheet();
    await userEvent.type(within(sheet()).getByLabelText("Say or type it"), "today 1200");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Fill the form for me" }));
    expect(await within(sheet()).findByText(/not switched on yet/)).toBeInTheDocument();
  });

  it("shows a question the assistant needs answered rather than guessing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { entries: [], question: "Which day was this?" })));
    renderUi(<EarningsView />);
    await screen.findByText(/No earnings yet/);
    await openSheet();
    await userEvent.type(within(sheet()).getByLabelText("Say or type it"), "I made some money");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Fill the form for me" }));
    expect(await within(sheet()).findByText("Which day was this?")).toBeInTheDocument();
  });
});

describe("EarningsView: an entry proposed by the chat", () => {
  it("opens the sheet already filled in, and saves nothing until the worker presses Save", async () => {
    setHandoff("earnings", { entries: [entry({ platform: "Zomato", grossInr: 2100 })] });
    renderUi(<EarningsView />);

    expect(await screen.findByRole("dialog", { name: "Add earnings" })).toBeInTheDocument();
    expect(within(sheet()).getByLabelText("App or work")).toHaveValue("Zomato");
    expect(within(sheet()).getByLabelText("Earned (Rs)")).toHaveValue("2100");
    expect(await listEntries()).toHaveLength(0);

    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));
    await waitFor(async () => expect(await listEntries()).toHaveLength(1));
  });

  it("Cancel saves nothing", async () => {
    setHandoff("earnings", { entries: [entry()] });
    renderUi(<EarningsView />);
    await screen.findByRole("dialog", { name: "Add earnings" });
    await userEvent.click(within(sheet()).getByRole("button", { name: "Cancel" }));
    expect(await listEntries()).toHaveLength(0);
  });
});

describe("EarningsView: the week, warnings and next steps", () => {
  it("shows warnings, and a big cut offers a complaint already filled in from the worker's own entries", async () => {
    await addEntries([
      entry({ platform: "Zomato", grossInr: 1000, deductionsInr: 400, fuelInr: 0 }),
      entry({ date: "2020-01-01" }), // an old entry that must not matter
    ]);
    renderUi(<EarningsView />);

    expect(await screen.findByText("Worth a look")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Write a complaint about this" }));

    expect(push).toHaveBeenCalledWith("/help/complaint");
    const handoff = peekHandoff("complaint");
    expect(handoff).toMatchObject({ issue: "penalty", party: "Zomato", amountInr: 400 });
    expect(handoff?.description).toContain("Rs 400");
    expect(handoff?.description).toContain("40%");
  });

  it("shows no complaint button when nothing looks wrong", async () => {
    await addEntries([entry({ deductionsInr: 50 })]);
    renderUi(<EarningsView />);
    await screen.findByText("Recent entries");
    expect(screen.queryByRole("button", { name: "Write a complaint about this" })).not.toBeInTheDocument();
  });

  it("deletes an entry only after the worker confirms", async () => {
    await addEntries([entry()]);
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("confirm", confirm);
    renderUi(<EarningsView />);
    const del = await screen.findByRole("button", { name: /^Delete:/ });

    await userEvent.click(del); // says no
    expect(await listEntries()).toHaveLength(1);

    await userEvent.click(del); // says yes
    await waitFor(async () => expect(await listEntries()).toHaveLength(0));
  });
});

describe("EarningsView: explaining the week", () => {
  it("sends only totals, never the individual entries or app names", async () => {
    await addEntries([entry({ platform: "SecretPlatformName" })]);
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { text: "You did well this week." }));
    vi.stubGlobal("fetch", fetchMock);
    renderUi(<EarningsView />);

    await userEvent.click(await screen.findByRole("button", { name: "Explain my week" }));
    expect(await screen.findByText("You did well this week.")).toBeInTheDocument();

    const sent = (fetchMock.mock.calls[0][1] as RequestInit).body as string;
    expect(sent).not.toContain("SecretPlatformName");
    expect(JSON.parse(sent).summary).toMatchObject({ gross: 1850, fuel: 400 });
  });

  it("says plainly when the AI is not available", async () => {
    await addEntries([entry()]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderUi(<EarningsView />);
    await userEvent.click(await screen.findByRole("button", { name: "Explain my week" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/No internet/);
  });
});

describe("EarningsView: accessibility", () => {
  it("has no violations with data on screen", async () => {
    await addEntries([entry({ deductionsInr: 600, grossInr: 1000 })]);
    const { container } = renderUi(<EarningsView />);
    await screen.findByText("Recent entries");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no violations with the sheet open", async () => {
    const { container } = renderUi(<EarningsView />);
    await screen.findByText(/No earnings yet/);
    await openSheet();
    expect(await axe(container)).toHaveNoViolations();
  });
});
