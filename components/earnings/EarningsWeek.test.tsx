import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _openForTest, addEntries } from "@/lib/db";
import { addDays, todayISO } from "@/lib/earnings/dates";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { EarningsView } from "./EarningsView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

let dbCounter = 0;
beforeEach(() => {
  _openForTest(`earnings-week-${++dbCounter}`); // a fresh on-device database for every test
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** One day's work with nothing taken out, so net equals what was earned. */
const day = (daysAgo: number, grossInr: number, platform = "Swiggy") => ({
  date: addDays(todayISO(), -daysAgo),
  platform,
  grossInr,
  deductionsInr: 0,
  fuelInr: 0,
  otherCostInr: 0,
});

describe("EarningsView: this week against the week before", () => {
  it("says how much more the worker kept when this week beat last week", async () => {
    await addEntries([day(1, 1500), day(9, 1000)]);
    renderUi(<EarningsView />);
    expect(await screen.findByText("50% more than the 7 days before")).toBeInTheDocument();
  });

  it("says how much less when this week was worse", async () => {
    await addEntries([day(1, 500), day(9, 1000)]);
    renderUi(<EarningsView />);
    expect(await screen.findByText("50% less than the 7 days before")).toBeInTheDocument();
  });

  it("says about the same instead of a tiny percentage when the weeks match", async () => {
    await addEntries([day(1, 1000), day(9, 1000)]);
    renderUi(<EarningsView />);
    expect(await screen.findByText("About the same as the 7 days before")).toBeInTheDocument();
  });

  it("does not invent a comparison when there is no earlier week", async () => {
    await addEntries([day(1, 1000)]);
    renderUi(<EarningsView />);
    expect(await screen.findByText("Not enough earlier days to compare yet.")).toBeInTheDocument();
  });

  it("shows seven bars with a readable label each, and keeps the loss days distinct", async () => {
    await addEntries([day(0, 1200), day(2, 600), { ...day(3, 100), fuelInr: 400 }]); // day 3 lost money
    renderUi(<EarningsView />);
    const bars = within(await screen.findByRole("list", { name: "Net per day" })).getAllByRole("listitem");
    expect(bars).toHaveLength(7);
    expect(bars[6]).toHaveAccessibleName(/₹1,200/); // today is the last bar
    expect(bars[3]).toHaveAccessibleName(/[−-]₹300/); // the loss shows as a loss
    expect(bars[4]).toHaveAccessibleName(/₹600/);
    expect(bars[5]).toHaveAccessibleName(/₹0/); // an empty day is zero, not missing
  });

  it("has no accessibility violations once there is a week to compare", async () => {
    await addEntries([day(1, 1500), day(9, 1000)]);
    const { container } = renderUi(<EarningsView />);
    await screen.findByText("50% more than the 7 days before");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("EarningsView: pay per hour", () => {
  it("shows what the worker earns an hour when they entered their hours", async () => {
    await addEntries([{ ...day(1, 1000), hours: 5 }]);
    renderUi(<EarningsView />);
    const label = await screen.findByText("Net per hour");
    expect(label.nextElementSibling).toHaveTextContent("₹200");
  });

  it("shows a dash instead of a made-up hourly pay when no hours were entered", async () => {
    await addEntries([day(1, 1000)]);
    renderUi(<EarningsView />);
    const label = await screen.findByText("Net per hour");
    expect(label.nextElementSibling).toHaveTextContent("–");
  });
});

describe("EarningsView: download as a spreadsheet", () => {
  it("saves every entry to a CSV file the worker can open anywhere", async () => {
    await addEntries([day(1, 1500, "Zomato"), day(9, 1000, "उबर")]);
    let saved: Blob | null = null;
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      saved = b as Blob;
      return "blob:saathi-test";
    });
    URL.revokeObjectURL = vi.fn();
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    renderUi(<EarningsView />);

    await userEvent.click(await screen.findByRole("button", { name: "Download CSV" }));

    expect(clicks).toEqual([`saathi-earnings-${todayISO()}.csv`]);
    const text = await (saved as unknown as Blob).text();
    expect(text).toContain("Zomato");
    expect(text).toContain("उबर");
    expect(text.split("\n").filter(Boolean)).toHaveLength(3); // header and two entries
  });
});

describe("EarningsView: when the phone cannot store anything", () => {
  it("says plainly that this browser cannot save, instead of showing an empty screen as if all is well", async () => {
    vi.stubGlobal("indexedDB", undefined);
    renderUi(<EarningsView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This browser cannot save on your phone.");
    expect(screen.queryByRole("button", { name: "Add earnings" })).not.toBeInTheDocument();
  });
});

describe("EarningsView: reopening the app after midnight", () => {
  it("moves 'today' to the new day when the worker comes back, without a reload", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 17, 22, 30));
    await addEntries([
      { date: "2026-10-17", platform: "Swiggy", grossInr: 1850, deductionsInr: 0, fuelInr: 400, otherCostInr: 0 },
    ]);
    renderUi(<EarningsView />);
    expect(await screen.findByText("₹1,450", { selector: ".plate-num" })).toBeInTheDocument();

    vi.setSystemTime(new Date(2026, 9, 18, 7, 0)); // the next morning
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(screen.getByText("₹0", { selector: ".plate-num" })).toBeInTheDocument(); // a fresh day, nothing earned yet
    expect(screen.getByText("Recent entries")).toBeInTheDocument(); // yesterday is still in the history
  });
});
